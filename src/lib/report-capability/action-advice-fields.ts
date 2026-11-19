import type {ActionAdviceView} from "./action-advice";

export function actionAdviceFields(advice: ActionAdviceView): [string, string[]][] {
  const effort = advice.effort === "not_assessed" ? "not assessed" : advice.effort;
  return [
    ["Problem", advice.problem],
    ["Evidence", advice.evidence],
    ["Why it matters", advice.whyImportant],
    ["How to fix it", advice.fix],
    ["Where to make the change", [advice.where]],
    ["Priority / effort", [`${advice.priority} / ${effort}`]],
    ["Confidence", [advice.confidence]],
    ["How to verify", advice.verification],
  ];
}
