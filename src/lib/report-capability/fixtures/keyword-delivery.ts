/** Synthetic, locally generated report and approval; never calls a service. */
import sample from './keywords-v14/mixed.json';
import {validateCapabilityReport} from '../validate';
import {initialCapabilityRevision} from '../revision';
import {buildApprovedCapabilityDelivery} from '../delivery';
export function keywordDelivery(){
 const checked=validateCapabilityReport(sample);
 if(!checked.ok)throw Error('Invalid synthetic keyword fixture');
 const report=checked.report,content=initialCapabilityRevision(report);
 content.status='approved';
 return {report,delivery:buildApprovedCapabilityDelivery(report,{
  id:'00000000-0000-4000-8000-000000009999',report_id:report.id,user_id:report.input_manifest.user_id,
  case_id:report.input_manifest.case_id,revision:1,status:'approved',approved_at:report.generated_at,content,
 })};
}
