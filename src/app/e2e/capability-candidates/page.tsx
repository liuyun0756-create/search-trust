import {notFound} from 'next/navigation';
import {isLocalE2ETestMode} from '@/lib/e2e-v22/config';
import {localCandidateReport} from './local-report';
import {initialCapabilityRevision} from '@/lib/report-capability/revision';
import {CandidatePreview} from './preview';
export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false},title:'Local candidate review preview'};
export default async function Page({searchParams}:{searchParams:Promise<{scenario?:string}>}){
  if(!isLocalE2ETestMode())notFound();
  const query=await searchParams;
  const scenario=['dependencies','empty','seamless'].includes(query.scenario??'')?query.scenario!:'five';
  const report=localCandidateReport(scenario);
  return <CandidatePreview report={report} initial={initialCapabilityRevision(report)} scenario={scenario}/>;
}
