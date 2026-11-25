import type {BusinessIdentityV2, CapabilityReport, ContactCheck, IdentityInheritance, OperatingModeAssessment} from '../report-capability/generated/types';
export type Mode='storefront'|'service_area'|'hybrid'|'meeting_point';
export const modeLabels:Record<Mode,string>={storefront:'Storefront',service_area:'Service area',hybrid:'Storefront + on-site service',meeting_point:'Meeting point'};
export { supportsIdentityReview } from "../report-capability/identity-versions";

export type IdentityStatusRow = {label: string; value: string; detail?: string};

export function identityStatusRows(identity?: BusinessIdentityV2, inheritance?: IdentityInheritance): IdentityStatusRow[] {
  const mode = identity?.operating_model;
  const branch = identity?.selected_branch_ref;
  const manualBranch = branch && (inheritance?.branch === "retained"
    || mode?.confirmation_ref?.selected_branch_ref === branch);
  const location = identity?.operating_location;
  const confirmedVisit = branch && location?.state === "seo_confirmed" && location.role === "customer_facing"
    && location.confirmation_ref?.selected_branch_ref === branch;
  return [
    { label: "GBP branch match", value: identity && inheritance?.branch === "needs_confirmation" ? "Needs confirmation"
      : manualBranch ? "Manually confirmed" : identity?.identity_match.state === "matched" ? "Machine matched" : "No saved match" },
    { label: "Operating model", value: mode?.confirmation_ref ? "Manually confirmed"
      : mode?.state === "resolved" ? "Machine identified · awaiting confirmation" : "Unknown",
      detail: mode?.value ? modeLabels[mode.value] : undefined },
    { label: "Customer visits at this address", value: confirmedVisit ? "Confirmed"
      : mode?.value === "service_area" || mode?.value === "meeting_point" ? "Not applicable" : "Unconfirmed" },
  ];
}
export type Selection={operating_model:Mode|null;branch_ref:string;reason:string;customers_can_visit?:boolean};
export type Workspace={schema_version:'identity_review_workspace_v1';report_id:string;base_checksum:string;identity_revision:number;delivery_revision:number;identity:BusinessIdentityV2;automatic:OperatingModeAssessment;notes:string[];branches:{ref:string;name:string|null;address:string|null;website:string|null;phone:string|null;available_for_reassessment:boolean;domain_match:boolean|null;phone_match:boolean|null}[];lookup_status:string;lookup_reason:string;lookup_attempts:number;evidence_as_of:string;checks:ContactCheck[]};
export type Preview={request_id:string;state:'preview'|'committed';selection:Selection;report:CapabilityReport;report_checksum:string;expected_identity_revision:number;expected_delivery_revision:number;difference:{before:ContactCheck[];after:ContactCheck[];removed_action_ids:string[];added_action_ids:string[];removed_actions:{title:string;target:string}[];added_actions:{title:string;target:string}[];copy_migrated:false;requires_approval:true;evidence_as_of:string;evaluated_at:string}};
