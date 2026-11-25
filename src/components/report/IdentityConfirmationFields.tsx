import {modeLabels, type Mode} from "@/lib/identity-review/view";

export interface IdentityBranchOption {
  ref: string;
  name: string | null;
  address: string | null;
  unavailable?: boolean;
  evidence?: string;
}

export interface IdentityFieldValues {
  branch: string;
  mode: Mode | "";
  reason: string;
  customersCanVisit: boolean;
}

export function IdentityConfirmationFields({branches, values, onChange, disabled, optionalMode = false, preserveSavedVisit = false, unconfirmedModeLabel}: {
  branches: IdentityBranchOption[];
  values: IdentityFieldValues;
  onChange(value: IdentityFieldValues): void;
  disabled: boolean;
  optionalMode?: boolean;
  preserveSavedVisit?: boolean;
  unconfirmedModeLabel?: string;
}) {
  const {branch, mode, reason, customersCanVisit} = values;
  const selected = branches.find((item) => item.ref === branch);
  const fieldClass = "mt-2 w-full rounded-lg border border-[#c8d4ca] bg-white p-3";
  const canShowVisit = (mode === "storefront" || mode === "hybrid" || (!mode && preserveSavedVisit))
    && branch && (!optionalMode || selected?.address);
  return <fieldset disabled={disabled} className="mt-5 grid gap-5 sm:grid-cols-2">
    <label className="font-medium">Operating model{optionalMode ? " (optional)" : ""}
      <select aria-label={optionalMode ? "Operating model (optional)" : "Operating model"} className={fieldClass} value={mode}
        onChange={(event) => onChange({...values, mode: event.target.value as Mode | "",
          customersCanVisit: !event.target.value && preserveSavedVisit && customersCanVisit})}>
        <option value="">{unconfirmedModeLabel ?? (optionalMode ? "Confirm after the report" : "Choose an operating model")}</option>
        {Object.entries(modeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
    </label>
    <label className="font-medium">Google Business Profile
      <select aria-label="Google Business Profile" className={fieldClass} value={branch}
        onChange={(event) => onChange({...values, branch: event.target.value, customersCanVisit: false})}>
        <option value="">Choose the business profile</option>
        {branches.map((item) => <option key={item.ref} value={item.ref}>
          {item.name ?? "Business profile"} · {item.address ?? "Address not supplied"}{item.unavailable ? " · saved details required" : ""}
        </option>)}
      </select>
    </label>
    {selected?.evidence && <p className="text-sm sm:col-span-2">{selected.evidence}</p>}
    {canShowVisit && <label className="flex items-start gap-3 rounded-lg border border-[#c8d4ca] bg-white p-4 sm:col-span-2">
      <input type="checkbox" aria-label="Customers can visit this Google Business Profile address" className="mt-1"
        checked={customersCanVisit} onChange={(event) => onChange({...values, customersCanVisit: event.target.checked})}/>
      <span>Customers can visit this Google Business Profile address
        <span className="mt-1 block text-sm font-normal">Confirm this only for the selected profile address. Leaving it unchecked keeps the address check unavailable.</span>
        <span className="mt-2 block text-sm font-normal">{selected?.address ?? "No saved address is available."}</span>
      </span>
    </label>}
    <label className="font-medium sm:col-span-2">Confirmation reason
      <textarea aria-label="Confirmation reason" required className={fieldClass} value={reason} maxLength={1000} rows={2}
        onChange={(event) => onChange({...values, reason: event.target.value})}
        placeholder={optionalMode ? "How did you confirm this branch?" : "How did you confirm the operating model and this branch?"}/>
    </label>
  </fieldset>;
}
