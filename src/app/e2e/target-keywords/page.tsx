import Link from 'next/link';
import {notFound} from 'next/navigation';
import {isLocalE2ETestMode} from '@/lib/e2e-v22/config';
import {NewCaseWorkspace} from '@/components/cases/new-case-workspace';
import {CapabilityReportDocument} from '@/components/report/CapabilityReportDocument';
import {projectCapabilityReport} from '@/lib/report-capability/projection';
import {validateCapabilityReport} from '@/lib/report-capability/validate';
import sample from '@/lib/report-capability/fixtures/keywords-v14/confirmed-report.json';
export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false},title:'Offline confirmed keyword journey'};
export default async function Page({searchParams}:{searchParams:Promise<{view?:string}>}){
 if(!isLocalE2ETestMode())notFound();
 const {view}=await searchParams;
 if(!view)return <NewCaseWorkspace keywordsEnabled/>;
 const checked=validateCapabilityReport(sample);if(!checked.ok)throw Error('Invalid local confirmed keyword fixture');
 const advisor=view==='advisor';
 return <main className="bg-[#f7faf7] p-6"><nav className="mx-auto mb-6 flex max-w-4xl gap-6"><Link href="/e2e/target-keywords?view=client">Client preview</Link><Link href="/e2e/target-keywords?view=advisor">Advisor preview</Link></nav><p className="mx-auto mb-6 max-w-4xl">Synthetic v14 report · mock collection · no real credits or providers.</p><CapabilityReportDocument document={projectCapabilityReport(checked.report,undefined,!advisor)} technicalDetails={advisor}/></main>;
}
