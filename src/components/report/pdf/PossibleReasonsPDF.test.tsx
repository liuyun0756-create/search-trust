import React from 'react';
import {renderToBuffer} from '@react-pdf/renderer';
import {expect,it} from 'vitest';
import {reasonsDelivery} from '@/lib/report-capability/fixtures/reasons-delivery';
import {projectCapabilityReport} from '@/lib/report-capability/projection';
import {CapabilityReportPDFDocument} from './CapabilityReportPDFDocument';
function text(node:unknown):string{
 if(!node||typeof node!=='object')return '';
 const x=node as {type?:string;value?:string;children?:unknown[]};
 return x.type==='TEXT_INSTANCE'?x.value??'':x.children?.map(text).join('\n')??'';
}
it('renders actual possible reason PDF text and strips all advisor evidence',async()=>{
 const {report,delivery}=reasonsDelivery();
 // Defense in depth when a caller accidentally supplies the advisor module.
 delivery.document.possibleReasons=projectCapabilityReport(report).possibleReasons;
 const before=JSON.stringify(delivery);let output='';
 const pdf=await renderToBuffer(React.cloneElement(CapabilityReportPDFDocument({delivery}),{
  onRender:(r:unknown)=>{output=text((r as {_INTERNAL__LAYOUT__DATA_:unknown})._INTERNAL__LAYOUT__DATA_);},
 }));
 expect(pdf.subarray(0,4).toString()).toBe('%PDF');
 expect(output).toContain('Possible contributing factors');
 expect(output).toContain('Sample competitor ratings:');
 expect(output).toContain('Sample competitor review totals:');
 expect(output).toContain('may be one contributing factor');
 expect(output).toContain('These observations do not establish ranking causation.');
 expect(output).not.toMatch(/basis_refs|competitor_indices|source_refs|"ratio"|provider_position|\/payload\/|latitude|Inspect landing page comparison sources/);
 expect(JSON.stringify(delivery)).toBe(before);
});
