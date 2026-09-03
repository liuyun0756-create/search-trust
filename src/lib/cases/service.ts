import type { BusinessIdentity } from "@/lib/report-v22/generated/types";
import type { CaseListQuery, CaseLocation, CaseOperatingModel, CaseStatus } from "./contracts";
import { CaseApiError } from "./errors";
import {
  buildBusinessIdentity,
  caseLocationKey,
  type NormalizedCreateCaseInput,
  type NormalizedUpdateCaseInput,
} from "./normalize";
import {
  CasePersistenceError,
  type CaseRecord,
  type CaseRepository,
  type UpdateCaseRecord,
} from "./repository";

export interface CaseResource {
  id: string;
  site_url: string;
  normalized_domain: string;
  business_name: string;
  business_identity: BusinessIdentity;
  operating_model: CaseOperatingModel;
  primary_service: string;
  target_market: CaseLocation;
  status: CaseStatus;
  latest_report_id: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CasePage {
  items: CaseResource[];
  total: number;
  limit: number;
  offset: number;
}

export interface CaseService {
  create(userId: string, input: NormalizedCreateCaseInput): Promise<CaseResource>;
  list(userId: string, query: CaseListQuery): Promise<CasePage>;
  get(userId: string, caseId: string): Promise<CaseResource>;
  update(userId: string, caseId: string, input: NormalizedUpdateCaseInput): Promise<CaseResource>;
  archive(userId: string, caseId: string): Promise<CaseResource>;
}

function toResource(record: CaseRecord): CaseResource {
  return {
    id: record.id,
    site_url: record.site_url,
    normalized_domain: record.normalized_domain,
    business_name: record.business_name,
    business_identity: record.business_identity,
    operating_model: record.operating_model,
    primary_service: record.primary_service,
    target_market: record.target_market,
    status: record.status,
    latest_report_id: record.latest_report_id,
    archived_at: record.archived_at,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

async function internalize<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof CaseApiError) throw error;
    throw CaseApiError.internal();
  }
}

async function existingOrNotFound(
  repository: CaseRepository,
  userId: string,
  caseId: string,
): Promise<CaseRecord> {
  const record = await repository.findById(userId, caseId);
  if (!record) throw CaseApiError.notFound();
  return record;
}

async function duplicateError(
  repository: CaseRepository,
  userId: string,
  normalizedDomain: string,
  locationKey: string,
  excludeCaseId?: string,
): Promise<CaseApiError> {
  const duplicate = await repository.findDuplicate(
    userId,
    normalizedDomain,
    locationKey,
    excludeCaseId,
  );
  return duplicate
    ? CaseApiError.duplicate(duplicate.id, duplicate.status)
    : CaseApiError.internal();
}

export function createCaseService(repository: CaseRepository): CaseService {
  return {
    async create(userId, input) {
      return internalize(async () => {
        const existing = await repository.findDuplicate(
          userId,
          input.normalized_domain,
          input.location_key,
        );
        if (existing) throw CaseApiError.duplicate(existing.id, existing.status);

        try {
          const created = await repository.create({
            ...(input.draft_case_id ? { id: input.draft_case_id } : {}),
            user_id: userId,
            site_url: input.site_url,
            normalized_domain: input.normalized_domain,
            business_name: input.business_name,
            business_identity: input.business_identity,
            operating_model: input.operating_model,
            primary_service: input.primary_service,
            target_market: input.target_market,
          });
          return toResource(created);
        } catch (error) {
          if (error instanceof CasePersistenceError && error.code === "23505") {
            throw await duplicateError(
              repository,
              userId,
              input.normalized_domain,
              input.location_key,
            );
          }
          throw error;
        }
      });
    },

    async list(userId, query) {
      return internalize(async () => {
        const result = await repository.list(userId, query);
        return {
          items: result.items.map(toResource),
          total: result.total,
          limit: query.limit,
          offset: query.offset,
        };
      });
    },

    async get(userId, caseId) {
      return internalize(async () => toResource(await existingOrNotFound(repository, userId, caseId)));
    },

    async update(userId, caseId, input) {
      return internalize(async () => {
        const existing = await existingOrNotFound(repository, userId, caseId);

        if (input.status === "active") {
          if (existing.status === "active") {
            throw CaseApiError.invalid([{ path: "/status", message: "the Case is already active" }]);
          }
          const restored = await repository.restoreArchived(userId, caseId);
          return toResource(restored ?? await existingOrNotFound(repository, userId, caseId));
        }

        if (existing.status === "archived") throw CaseApiError.archived();

        const currentIdentity = existing.business_identity;
        const businessName = input.business_name ?? existing.business_name;
        const operatingModel = input.operating_model ?? existing.operating_model;
        const primaryLocation = input.primary_location ?? currentIdentity.primary_location as CaseLocation;
        const publicGbpUrl = input.public_gbp_url !== undefined
          ? input.public_gbp_url
          : currentIdentity.public_gbp_url ?? null;
        const locationKey = caseLocationKey(primaryLocation);

        if (input.primary_location) {
          const duplicate = await repository.findDuplicate(
            userId,
            existing.normalized_domain,
            locationKey,
            existing.id,
          );
          if (duplicate) throw CaseApiError.duplicate(duplicate.id, duplicate.status);
        }

        const update: UpdateCaseRecord = {
          ...(input.business_name !== undefined ? { business_name: businessName } : {}),
          ...(input.operating_model !== undefined ? { operating_model: operatingModel } : {}),
          ...(input.primary_service !== undefined ? { primary_service: input.primary_service } : {}),
          ...(input.target_market !== undefined ? { target_market: input.target_market } : {}),
        };
        if (
          input.business_name !== undefined ||
          input.operating_model !== undefined ||
          input.primary_location !== undefined ||
          input.public_gbp_url !== undefined
        ) {
          update.business_identity = buildBusinessIdentity({
            businessName,
            siteUrl: existing.site_url,
            normalizedDomain: existing.normalized_domain,
            operatingModel,
            primaryLocation,
            publicGbpUrl,
          });
        }

        try {
          const updated = await repository.updateActive(userId, caseId, update);
          if (updated) return toResource(updated);
          const current = await existingOrNotFound(repository, userId, caseId);
          if (current.status === "archived") throw CaseApiError.archived();
          return toResource(current);
        } catch (error) {
          if (error instanceof CasePersistenceError && error.code === "23505") {
            throw await duplicateError(
              repository,
              userId,
              existing.normalized_domain,
              locationKey,
              existing.id,
            );
          }
          throw error;
        }
      });
    },

    async archive(userId, caseId) {
      return internalize(async () => {
        const existing = await existingOrNotFound(repository, userId, caseId);
        if (existing.status === "archived") return toResource(existing);
        const archived = await repository.archiveActive(userId, caseId, new Date().toISOString());
        return toResource(archived ?? await existingOrNotFound(repository, userId, caseId));
      });
    },
  };
}
