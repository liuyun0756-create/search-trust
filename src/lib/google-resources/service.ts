import type { SupabaseClient } from "@supabase/supabase-js";
import type { CaseSourceBinding } from "@/types/database";
import type { GoogleConnectionService } from "../google-connections/service";
import type { GoogleConnectionRepository } from "../google-connections/repository";
import { ResourceError, type GoogleResource, type ResourceQuery, type ResourceSelection } from "./contracts";
import type { ResourceProvider } from "./provider";

export interface ResourceRepository {
  caseOwned(userId: string, caseId: string): Promise<boolean>;
  listBindings(caseId: string): Promise<CaseSourceBinding[]>;
  bind(userId: string, caseId: string, input: ResourceSelection, resource: GoogleResource): Promise<CaseSourceBinding>;
  disconnect(userId: string, caseId: string, bindingId: string): Promise<void>;
}

function dbError(error: { code?: string } | null) {
  if (!error) return;
  if (error.code === "40001") throw new ResourceError("BINDING_CHANGED", 409);
  if (error.code === "42501") throw new ResourceError("FORBIDDEN", 403);
  throw new ResourceError("PERSISTENCE_FAILED", 503);
}

export class SupabaseResourceRepository implements ResourceRepository {
  constructor(private readonly db: SupabaseClient) {}
  async caseOwned(userId: string, caseId: string) {
    const { data, error } = await this.db.from("client_cases").select("id").eq("id", caseId).eq("user_id", userId).eq("status", "active").maybeSingle();
    dbError(error);
    return !!data;
  }
  async listBindings(caseId: string): Promise<CaseSourceBinding[]> {
    const { data, error } = await this.db.from("case_source_bindings").select("*").eq("case_id", caseId).eq("is_active", true).order("source_type");
    dbError(error);
    return data ?? [];
  }
  async bind(userId: string, caseId: string, input: ResourceSelection, resource: GoogleResource): Promise<CaseSourceBinding> {
    const { data, error } = await this.db.rpc("select_v22_google_resource", {
      p_user_id: userId, p_case_id: caseId, p_connection_id: input.connection_id, p_source: input.source,
      p_resource_id: resource.id, p_resource_name: resource.name, p_parent: resource.parent,
      p_expected_binding_id: input.expected_binding_id,
    }).single();
    dbError(error);
    if (!data) throw new ResourceError("PERSISTENCE_FAILED", 503);
    return data as CaseSourceBinding;
  }
  async disconnect(userId: string, caseId: string, bindingId: string) {
    const { error } = await this.db.rpc("disconnect_v22_google_resource", { p_user_id: userId, p_case_id: caseId, p_binding_id: bindingId });
    dbError(error);
  }
}

export function createResourceService(deps: {
  repository: ResourceRepository;
  connections: Pick<GoogleConnectionRepository, "findConnectionById">;
  tokens: Pick<GoogleConnectionService, "getAccessToken">;
  provider: ResourceProvider;
}) {
  async function owned(userId: string, caseId: string, connectionId?: string) {
    if (!await deps.repository.caseOwned(userId, caseId)) throw new ResourceError("FORBIDDEN", 403);
    if (connectionId && !await deps.connections.findConnectionById(userId, connectionId)) throw new ResourceError("FORBIDDEN", 403);
  }
  return {
    async bindings(userId: string, caseId: string) {
      await owned(userId, caseId);
      const bindings = await deps.repository.listBindings(caseId);
      // Explicit public projection; never spread database rows into browser responses.
      return bindings.map(b => ({ id: b.id, connection_id: b.connection_id, source_type: b.source_type,
        external_resource_id: b.external_resource_id, external_resource_name: b.external_resource_name,
        identity_match_status: b.identity_match_status, health_status: b.health_status, confirmed_at: b.confirmed_at }));
    },
    async discover(userId: string, caseId: string, connectionId: string, query: ResourceQuery, requestId: string, resourceId?: string) {
      await owned(userId, caseId, connectionId);
      const token = await deps.tokens.getAccessToken(connectionId, query.source, requestId);
      if (resourceId) return { resources: [await deps.provider.verify(token.accessToken, { ...query, resourceId })], next_page_token: null };
      return deps.provider.list(token.accessToken, query);
    },
    async bind(userId: string, caseId: string, input: ResourceSelection, requestId: string) {
      await owned(userId, caseId, input.connection_id);
      const token = await deps.tokens.getAccessToken(input.connection_id, input.source, requestId);
      const resource = await deps.provider.verify(token.accessToken, { source: input.source, parent: input.parent, resourceId: input.resource_id });
      if (!resource.selectable || resource.id !== input.resource_id || resource.source !== input.source || resource.parent !== input.parent) {
        throw new ResourceError("RESOURCE_UNAVAILABLE", 403);
      }
      const binding = await deps.repository.bind(userId, caseId, input, resource);
      return { binding_id: binding.id };
    },
    async disconnect(userId: string, caseId: string, bindingId: string) {
      await owned(userId, caseId);
      await deps.repository.disconnect(userId, caseId, bindingId);
    },
  };
}
export type ResourceService = ReturnType<typeof createResourceService>;
