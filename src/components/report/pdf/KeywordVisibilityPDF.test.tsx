import React from 'react';
import {renderToBuffer} from '@react-pdf/renderer';
import {expect,it} from 'vitest';
import {keywordDelivery} from '@/lib/report-capability/fixtures/keyword-delivery';
import {projectCapabilityReport} from '@/lib/report-capability/projection';
import {CapabilityReportPDFDocument} from './CapabilityReportPDFDocument';
function text(node:unknown):string{
 if(!node||typeof node!=='object')return '';
 const x=node as {type?:string;value?:string;children?:unknown[]};
 return x.type==='TEXT_INSTANCE'?x.value??'':x.children?.map(text).join('\n')??'';
}
it('lays out the actual PDF with first-page states, K/N and no advisor keyword data',async()=>{
 const {report,delivery}=keywordDelivery();
 // Defense in depth when a caller accidentally supplies the advisor module.
 delivery.document.keywordVisibility=projectCapabilityReport(report).keywordVisibility;
 const before=JSON.stringify(delivery);let output='';
 const pdf=await renderToBuffer(React.cloneElement(CapabilityReportPDFDocument({delivery}),{
  onRender:(r:unknown)=>{output=text((r as {_INTERNAL__LAYOUT__DATA_:unknown})._INTERNAL__LAYOUT__DATA_);},
 }));
 expect(pdf.subarray(0,4).toString()).toBe('%PDF');
 expect(output).toContain('Target keyword visibility');
 expect(output).toContain('Not observed on the first page of the sampled results.');
 expect(output).toContain('2/3 keywords checked');
 expect(output).not.toMatch(/Google Maps reference|"ratio"|provider_position|\/payload\/|latitude/);
 expect(JSON.stringify(delivery)).toBe(before);
});
