import React from 'react';
import {renderToBuffer} from '@react-pdf/renderer';
import {expect,it} from 'vitest';
import {gbpDelivery} from '@/lib/report-capability/fixtures/gbp-delivery';
import {projectCapabilityReport} from '@/lib/report-capability/projection';
import {CapabilityReportPDFDocument} from './CapabilityReportPDFDocument';
function text(node:unknown):string{
 if(!node||typeof node!=='object')return '';
 const x=node as {type?:string;value?:string;children?:unknown[]};
 return x.type==='TEXT_INSTANCE'?x.value??'':x.children?.map(text).join('\n')??'';
}
it('renders the actual GBP PDF with lower bounds and sample denominators, no advisor data',async()=>{
 const {report,delivery}=gbpDelivery();
 // Defense in depth when a caller accidentally supplies the advisor module.
 delivery.document.gbpComparison=projectCapabilityReport(report).gbpComparison;
 const before=JSON.stringify(delivery);let output='';
 const pdf=await renderToBuffer(React.cloneElement(CapabilityReportPDFDocument({delivery}),{
  onRender:(r:unknown)=>{output=text((r as {_INTERNAL__LAYOUT__DATA_:unknown})._INTERNAL__LAYOUT__DATA_);},
 }));
 expect(pdf.subarray(0,4).toString()).toBe('%PDF');
 expect(output).toContain('Google Business Profile comparison');
 expect(output).toContain('At least 30');
 expect(output).toContain('20/30 sampled reviews');
 expect(output).toContain('customer review samples were not collected');
 expect(output).not.toMatch(/source_refs|"ratio"|provider_position|\/payload\/|latitude|Inspect profile comparison sources/);
 expect(JSON.stringify(delivery)).toBe(before);
});
