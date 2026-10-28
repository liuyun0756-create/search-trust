import type { VerifiedReviewReport } from "./types";
import type { SavedReviewRevision } from "./delivery";
import { parseSavedRevision,validReviewRevision,type ReviewRevision } from "./delivery";
import { canonicalDigest } from "../verified-analysis-v22/digest";

export type ReviewClientDocument={reportId:string;reportVersion:number;revisionId:string;revision:number;contentChecksum:string;
  siteUrl:string;service:string;market:string;evaluatedAt:string;title:string;summary:string;clientNote:string|null;
  observations:{title:string;target:string;lines:string[]}[];prior:{title:string;summary:string;lines:string[]}[];
  actions:{id:string;title:string;target:string;steps:string[];completion:string[];review:string;materials:{title:string;body:string;target:string;readiness:string;confirmation_items:string[]}[]}[];limitations:string[]};
const dateRange=(w:{start:string;end:string})=>`${w.start} to ${w.end}`;
const readableLimit=(s:string)=>({GSC_QUERY_PRIVACY_FILTERING:"Some search queries may be omitted by Search Console privacy filtering.",GSC_WEB_ONLY:"Search Console observations cover web search only."}[s]??s);
export function projectReviewDelivery(r:VerifiedReviewReport,saved:SavedReviewRevision):ReviewClientDocument {
  const s=parseSavedRevision(saved,r);if(s.status!=="approved")throw new Error("REVIEW_NEEDS_APPROVAL");
  return projectReviewPreview(r,s.content,s.revision,s.id);
}
export function projectReviewPreview(r:VerifiedReviewReport,content:ReviewRevision,revision=0,revisionId="preview"):ReviewClientDocument {
  if(!validReviewRevision(content,r))throw new Error("REVIEW_INVALID");
  return {reportId:r.id,reportVersion:r.version,revisionId,revision,contentChecksum:canonicalDigest(content),
    siteUrl:r.business.site_url,service:r.business.primary_service,market:r.business.target_market,evaluatedAt:r.generated_at,
    title:content.title,summary:content.summary,clientNote:content.client_note,
    observations:r.content.client_actions.map(({facts:f,next_decision:d})=>{
      const lines:string[]=[f.recorded_work.state==="seo_recorded"?`SEO recorded implementation: ${f.recorded_work.implemented_on} (${f.recorded_work.timezone}). Completion is not system verified.`:"Implementation has not been recorded."];
      if(f.page){lines.push(`Page checked ${f.page.observed_at}: ${f.page.status}. ${f.page.comparison==="first_observation"?"First observation; no earlier page baseline.":f.page.comparison.replaceAll("_"," ")}.`);
        lines.push(...f.page.results.map(x=>`Page condition ${x.condition_id}: ${x.state.replaceAll("_"," ")}.`));
        lines.push("Static page response only; rendering and the full contact journey are not verified.");}
      else lines.push("No page observation selected.");
      if(f.gsc){const g=f.gsc;lines.push(`Search Console: ${g.state.replaceAll("_"," ")}. ${dateRange(g.windows.before)} versus ${dateRange(g.windows.after)} (${g.windows.timezone}).`);
        lines.push(...g.metrics.map(m=>`${m.metric.replaceAll("_"," ")}: ${m.before??"Unavailable"} → ${m.after??"Unavailable"} (${m.unit}).`),...g.limitations.map(readableLimit));}
      else lines.push("No Search Console comparison selected.");
      if(f.ga4){const g=f.ga4;lines.push(`Organic search sessions: ${g.state==="available"?`${g.before} → ${g.after}`:"Withheld; comparison conditions are not met"}. ${dateRange(g.windows.before)} versus ${dateRange(g.windows.after)} (${g.windows.timezone}).`);
        lines.push(`Landing scope: ${g.scope.landing_path??"All landing paths"}. Processing completeness is not attested; measurement history is unverified.`);}
      else lines.push("No GA4 comparison selected.");
      lines.push(...f.checks.map(c=>c.text),d.text);
      return {title:f.title,target:f.target,lines};}),
    prior:r.content.prior_diagnosis.findings.map(f=>({title:f.target,summary:f.observed_fact,lines:[f.judgment,`Original observation: ${f.observed_at}. ${f.comparison_scope}`,...f.limitations]})),
    actions:content.actions.map(a=>({id:a.id,title:a.title,target:a.target,steps:[...a.steps],completion:[...a.completion],review:a.review,
      materials:a.materials.map(m=>({title:m.title,body:m.body,target:m.target,readiness:m.readiness,confirmation_items:[...m.confirmation_items]}))})),
    limitations:[...r.limitations]};
}
