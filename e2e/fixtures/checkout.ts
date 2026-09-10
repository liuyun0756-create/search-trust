import { E2E_BUSINESS, E2E_MARKET, E2E_NOW } from "./preflight";
import { E2E_IDS } from "./ids";

export const caseFixture = {
  id: E2E_IDS.caseId,
  site_url: E2E_IDS.siteUrl,
  normalized_domain: "searchtrust-e2e.example.invalid",
  business_name: E2E_BUSINESS.business_name,
  business_identity: E2E_BUSINESS,
  operating_model: E2E_BUSINESS.operating_model,
  primary_service: "Emergency plumbing",
  target_market: E2E_MARKET,
  status: "active",
  latest_report_id: null,
  archived_at: null,
  created_at: E2E_NOW,
  updated_at: E2E_NOW,
} as const;

export function checkoutStateFixture(unlocked: boolean) {
  return {
    case_id: E2E_IDS.caseId,
    report_type: "prospect",
    entitlement_status: unlocked ? "available" : "locked",
    unlocked,
  } as const;
}

export const checkoutCreatedFixture = {
  case_id: E2E_IDS.caseId,
  order_id: E2E_IDS.orderId,
  checkout_session_id: "searchtrust_e2e_checkout_session",
  checkout_url: `http://127.0.0.1:3100/cases/new?payment=return&case_id=${E2E_IDS.caseId}&payment_id=searchtrust_e2e_payment`,
} as const;

export const checkoutConfirmedFixture = {
  ok: true,
  case_id: E2E_IDS.caseId,
  payment_id: "searchtrust_e2e_payment",
  entitlement_status: "available",
  already_confirmed: false,
} as const;

export const checkoutProviderErrorFixture = {
  error: { code: "CHECKOUT_UNAVAILABLE", message: "Secure checkout is temporarily unavailable." },
} as const;
