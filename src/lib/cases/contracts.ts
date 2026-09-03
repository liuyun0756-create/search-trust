import Ajv2020, { type ErrorObject } from "ajv/dist/2020";
import addFormats from "ajv-formats";

import type { TargetMarket } from "@/lib/report-v22/generated/types";

export type CaseOperatingModel = "storefront" | "service_area" | "hybrid";
export type CaseStatus = "active" | "archived";
export type CaseListStatus = CaseStatus | "all";
export type CaseLocation = Required<TargetMarket>;

export interface CaseLocationInput {
  display_name: string;
  country_code: string;
  region?: string | null;
  city?: string | null;
  postal_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface CreateCaseRequest {
  draft_case_id?: string;
  site_url: string;
  business_name: string;
  operating_model: CaseOperatingModel;
  primary_service: string;
  primary_location: CaseLocationInput;
  target_market: CaseLocationInput;
  public_gbp_url?: string | null;
}

export interface UpdateCaseRequest {
  business_name?: string;
  operating_model?: CaseOperatingModel;
  primary_service?: string;
  primary_location?: CaseLocationInput;
  target_market?: CaseLocationInput;
  public_gbp_url?: string | null;
  status?: "active";
}

export interface CaseListQuery {
  status: CaseListStatus;
  limit: number;
  offset: number;
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: ValidationIssue[] };

const nullableString = (maxLength: number) => ({
  anyOf: [
    { type: "string", maxLength },
    { type: "null" },
  ],
});

const nullableNumber = (minimum: number, maximum: number) => ({
  anyOf: [
    { type: "number", minimum, maximum },
    { type: "null" },
  ],
});

const locationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["display_name", "country_code"],
  properties: {
    display_name: { type: "string", minLength: 1, maxLength: 200 },
    country_code: { type: "string", maxLength: 10, pattern: "^\\s*[A-Za-z]{2}\\s*$" },
    region: nullableString(120),
    city: nullableString(120),
    postal_code: nullableString(32),
    latitude: nullableNumber(-90, 90),
    longitude: nullableNumber(-180, 180),
  },
};

const createCaseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "site_url",
    "business_name",
    "operating_model",
    "primary_service",
    "primary_location",
    "target_market",
  ],
  properties: {
    draft_case_id: {
      type: "string",
      pattern: "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
    },
    site_url: { type: "string", minLength: 1, maxLength: 2083 },
    business_name: { type: "string", minLength: 1, maxLength: 240 },
    operating_model: { enum: ["storefront", "service_area", "hybrid"] },
    primary_service: { type: "string", minLength: 1, maxLength: 200 },
    primary_location: locationSchema,
    target_market: locationSchema,
    public_gbp_url: {
      anyOf: [
        { type: "string", minLength: 1, maxLength: 2083 },
        { type: "null" },
      ],
    },
  },
};

const updateCaseSchema = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    business_name: { type: "string", minLength: 1, maxLength: 240 },
    operating_model: { enum: ["storefront", "service_area", "hybrid"] },
    primary_service: { type: "string", minLength: 1, maxLength: 200 },
    primary_location: locationSchema,
    target_market: locationSchema,
    public_gbp_url: {
      anyOf: [
        { type: "string", minLength: 1, maxLength: 2083 },
        { type: "null" },
      ],
    },
    status: { const: "active" },
  },
};

const ajv = new Ajv2020({
  allErrors: true,
  coerceTypes: false,
  removeAdditional: false,
  strict: true,
  useDefaults: false,
});
addFormats(ajv);

const validateCreate = ajv.compile<CreateCaseRequest>(createCaseSchema);
const validateUpdate = ajv.compile<UpdateCaseRequest>(updateCaseSchema);

function issuePath(error: ErrorObject): string {
  if (error.keyword === "additionalProperties") {
    const params = error.params as { additionalProperty: string };
    return `${error.instancePath}/${params.additionalProperty}` || "/";
  }
  return error.instancePath || "/";
}

function validationIssues(errors: ErrorObject[] | null | undefined): ValidationIssue[] {
  return (errors ?? []).map((error) => ({
    path: issuePath(error),
    message: error.message ?? "Invalid value.",
  }));
}

export function validateCreateCaseRequest(value: unknown): ValidationResult<CreateCaseRequest> {
  return validateCreate(value)
    ? { ok: true, value }
    : { ok: false, issues: validationIssues(validateCreate.errors) };
}

export function validateUpdateCaseRequest(value: unknown): ValidationResult<UpdateCaseRequest> {
  return validateUpdate(value)
    ? { ok: true, value }
    : { ok: false, issues: validationIssues(validateUpdate.errors) };
}
