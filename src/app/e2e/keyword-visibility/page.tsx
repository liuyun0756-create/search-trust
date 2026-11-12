import Link from 'next/link';
import {notFound} from 'next/navigation';
import {isLocalE2ETestMode} from '@/lib/e2e-v22/config';
import {keywordDelivery} from '@/lib/report-capability/fixtures/keyword-delivery';
import {projectCapabilityReport} from '@/lib/report-capability/projection';
import {CapabilityReportDocument} from '@/components/report/CapabilityReportDocument';
export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false},title:'Offline target keyword preview'};
export default async function Page({searchParams}:{searchParams:Promise<{advisor?:string}>}){
 if(!isLocalE2ETestMode())notFound();
 const advisor=(await searchParams).advisor==='1';
 const {report}=keywordDelivery();
 return <main className="bg-[#f7faf7] p-6">
  <nav aria-label="Offline preview views" className="mx-auto mb-6 flex max-w-4xl gap-6">
   <Link href="/e2e/keyword-visibility">Client preview</Link><Link href="/e2e/keyword-visibility?advisor=1">Advisor preview</Link>
  </nav>
  <p className="mx-auto mb-6 max-w-4xl">Synthetic offline preview. No collection or credits.</p>
  <CapabilityReportDocument document={projectCapabilityReport(report,undefined,!advisor)} technicalDetails={advisor}/>
 </main>;
}
