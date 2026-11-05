import {NextResponse} from 'next/server';
import {renderToBuffer} from '@react-pdf/renderer';
import {isLocalE2ETestMode} from '@/lib/e2e-v22/config';
import {localCandidateReport} from '../local-report';
import {validateDeliveryRevision} from '@/lib/report-capability/validate';
import {buildApprovedCapabilityDelivery} from '@/lib/report-capability/delivery';
import {CapabilityReportPDFDocument} from '@/components/report/pdf/CapabilityReportPDFDocument';
export const runtime='nodejs';
// Fixed local fixtures or checksum-bound offline replay; no account, secret or database client.
export async function POST(request:Request){
  if(!isLocalE2ETestMode())return new Response(null,{status:404});
  const origin=new URL(process.env.NEXT_PUBLIC_E2E_BASE_URL!).origin;
  if(request.headers.get('origin') && request.headers.get('origin')!==origin)return new Response(null,{status:403});
  const {content,scenario,pdf}=await request.json();
  const report=localCandidateReport(scenario);
  if(!validateDeliveryRevision(content,report))return NextResponse.json({ok:false,code:'CAPABILITY_INVALID'},{status:400});
  const revision=content.expected_revision+1;
  const delivery=content.status==='approved'?buildApprovedCapabilityDelivery(report,{id:'e2000000-0000-4000-8000-000000000009',report_id:report.id,user_id:report.input_manifest.user_id,case_id:report.input_manifest.case_id,revision,status:'approved',approved_at:'2026-11-05T00:00:00Z',content}):null;
  if(pdf){
    if(!delivery)return new Response(null,{status:400});
    const buffer=await renderToBuffer(CapabilityReportPDFDocument({delivery}));
    return new Response(new Uint8Array(buffer),{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="candidate-preview.pdf"','Cache-Control':'no-store'}});
  }
  return NextResponse.json({ok:true,revision,content,delivery},{headers:{'Cache-Control':'no-store'}});
}
