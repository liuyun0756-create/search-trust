import React from 'react';
import {renderToBuffer} from '@react-pdf/renderer';
import {expect,it} from 'vitest';
import {landingDelivery} from '@/lib/report-capability/fixtures/landing-delivery';
import {projectCapabilityReport} from '@/lib/report-capability/projection';
import {CapabilityReportPDFDocument} from './CapabilityReportPDFDocument';
function text(node:unknown):string{
 if(!node||typeof node!=='object')return '';
 const x=node as {type?:string;value?:string;children?:unknown[]};
 return x.type==='TEXT_INSTANCE'?x.value??'':x.children?.map(text).join('\n')??'';
}
it('renders the actual landing PDF with bounded counts and target-city limits, no advisor data',async()=>{
 const {report,delivery}=landingDelivery();
 // Defense in depth when a caller accidentally supplies the advisor module.
 delivery.document.landingPageComparison=projectCapabilityReport(report).landingPageComparison;
 const before=JSON.stringify(delivery);let output='';
 const pdf=await renderToBuffer(React.cloneElement(CapabilityReportPDFDocument({delivery}),{
  onRender:(r:unknown)=>{output=text((r as {_INTERNAL__LAYOUT__DATA_:unknown})._INTERNAL__LAYOUT__DATA_);},
 }));
 expect(pdf.subarray(0,4).toString()).toBe('%PDF');
 expect(output).toContain('Landing page comparison');
 expect(output).toContain('Page sample counts - Inference:');
 expect(output).toContain('home: 1');
 expect(output).toContain('Website credential claims');
 expect(output).toContain('These are not full-site totals.');
 expect(output).toContain('observed in the saved sample.');
 expect(output).toContain('20/30 sampled reviews');
 expect(output).toContain('customer reviews were not collected');
 expect(output).not.toMatch(/source_refs|"ratio"|provider_position|\/payload\/|latitude|Inspect landing page comparison sources/);
 expect(JSON.stringify(delivery)).toBe(before);
});
