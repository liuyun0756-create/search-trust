import type { BusinessScope, CapabilityFinding, PriorityCandidateInput, PrioritizationTrace, PriorityDecision } from './generated/types';
import { replayPriority } from './priority';

export function qualifiedTechnical(f: CapabilityFinding) {
  return ['v22_public.site_http_error','v22_public.site_explicit_noindex'].includes(f.rule_id)
    && f.kind === 'fact' && f.status === 'confirmed' && ['medium','high'].includes(f.confidence)
    && f.interpretation === 'supported' && f.evidence_ids.length > 0;
}
export function replayCandidates(inputs: PriorityCandidateInput[], findings: CapabilityFinding[], business: BusinessScope, checksum: string): PrioritizationTrace {
  const rankFindings = structuredClone(findings);
  for (const f of rankFindings) if (['v22_public.site_http_error','v22_public.site_explicit_noindex'].includes(f.rule_id) && !qualifiedTechnical(f)) f.rule_id='unqualified_technical_observation';
  const trace = replayPriority(inputs,rankFindings,business,checksum,'v22_business_priority_v2');
  const conditions=business.execution_conditions ?? {capacity:'unknown',publishing_access:'unknown'};
  const ranks={low:0,medium:1,high:2,critical:3};
  for (const e of trace.candidates) {
    const linked=e.input.finding_ids.map(id=>findings.find(f=>f.id===id)!);
    e.technical_finding_ids=linked.filter(qualifiedTechnical).map(f=>f.id).sort();
    e.default_visible=linked.some(f=>f.status==='confirmed' && f.confidence!=='low');
    e.selected_order=null;
    e.reason_codes=e.reason_codes.filter(c=>c!=='outside_delivery_budget') as PriorityDecision['reason_codes'];
  }
  const key=(e:PriorityDecision)=>[
    Number(!e.default_visible),{access_indexing:0,measurement:1,none:2}[e.prerequisite],
    {confirmed_target:0,confirmed_objective:1,not_matched:2,unknown:2}[e.business_match],
    {supported:0,needs_verification:1,conflicting:2}[e.evidence_support],-ranks[e.severity],-ranks[e.confidence],
    Number(conditions.capacity==='limited' && e.input.material_kinds.some(k=>['title_brief','service_brief','profile_correction'].includes(k))),
    {ready_to_use:0,instructions_only:1,confirmation_required:2}[e.execution],
  ];
  const pending=[...trace.candidates],order:string[]=[],chosen:string[]=[];
  while(pending.length) {
    const available=pending.filter(e=>e.input.dependencies.every(id=>order.includes(id)));
    if(!available.length) throw new Error('Cyclic candidate dependencies');
    available.sort((a,b)=>{const ak=key(a),bk=key(b);for(let i=0;i<ak.length;i++)if(ak[i]!==bk[i])return ak[i]-bk[i];return a.input.action_id<b.input.action_id?-1:a.input.action_id>b.input.action_id?1:0;});
    const e=available[0];order.push(e.input.action_id);
    if(e.default_visible && chosen.length<3 && e.input.dependencies.every(id=>chosen.includes(id))) {chosen.push(e.input.action_id);e.selected_order=chosen.length;}
    else e.reason_codes.push(!e.default_visible?'advisor_only_weak_basis':e.input.dependencies.some(id=>!chosen.includes(id))?'dependency_not_selected':'outside_delivery_budget');
    pending.splice(pending.indexOf(e),1);
  }
  return {...trace,rules_version:'v22_business_priority_v3',candidate_order:order,action_order:chosen as PrioritizationTrace['action_order']};
}
