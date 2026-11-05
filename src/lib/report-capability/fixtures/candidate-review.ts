// Isolated UI fixture: never modifies the committed phase-one report or gold truth.
import five from './candidates/five.json';
import dependencies from './candidates/dependencies.json';
import empty from './candidates/empty.json';
import {replayPriority,priorityCandidate} from '../priority';
import {validateCapabilityReport} from '../validate';
import type {CapabilityReport} from '../generated/types';
export function candidateReviewFixture(scenario='five'):CapabilityReport {
  const report=structuredClone(scenario==='dependencies'?dependencies:scenario==='empty'?empty:five) as unknown as CapabilityReport;
  if(scenario==='empty')return report;
  for(const action of report.action_candidates!.slice(1)){
    action.steps=[`Review the contact option on ${action.target}.`,'Confirm the intended next step with the business before editing.'];
    action.completion=['The agreed contact option is visible and usable.'];action.review='Review the page and record the result.';
    for(const material of action.materials){material.title=`Contact option brief ${action.id.split('-').at(-1)}`;material.body='Confirm the preferred contact option with the business, then prepare the page copy for approval.';}
  }
  report.findings.find(f=>f.id==='fn-synthetic-4')!.confidence='low';
  report.prioritization=replayPriority(report.action_candidates!.map(priorityCandidate),report.findings,report.input_manifest.business,report.input_manifest.input_checksum,'v22_business_priority_v3');
  report.action_candidates=report.prioritization.candidate_order!.map(id=>report.action_candidates!.find(a=>a.id===id)!);
  report.actions=report.prioritization.action_order.map(id=>report.action_candidates!.find(a=>a.id===id)!) as CapabilityReport['actions'];
  if(!validateCapabilityReport(report).ok)throw new Error('Invalid local candidate fixture');
  return report;
}
