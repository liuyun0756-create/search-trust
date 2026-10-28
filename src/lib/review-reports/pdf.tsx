import "server-only";
import React from "react";
import {Document,Page,View,Text,Image,renderToBuffer,StyleSheet} from "@react-pdf/renderer";
import {assertCapabilityPdfText} from "../report-pdf/capability-fonts";
import type {EffectiveBranding} from "../report-pdf/branding";
import type {ReviewClientDocument} from "./projection";
export const REVIEW_HEADERS={"Cache-Control":"private, no-store, max-age=0","Referrer-Policy":"no-referrer","X-Robots-Tag":"noindex, nofollow, noarchive"};
const s=StyleSheet.create({page:{padding:38,paddingBottom:65,fontFamily:"CapabilitySans",fontSize:9,lineHeight:1.55,color:"#203d32"},h1:{fontFamily:"CapabilitySansBold",fontSize:23,marginBottom:15},h2:{fontFamily:"CapabilitySansBold",fontSize:14,marginTop:18,marginBottom:9},h3:{fontFamily:"CapabilitySansBold",fontSize:11,marginTop:12,marginBottom:7},text:{marginBottom:7},meta:{fontSize:8,color:"#617469",marginBottom:8},footer:{position:"absolute",top:790,left:38,right:38,fontSize:7,color:"#617469",flexDirection:"row",justifyContent:"space-between"},logo:{width:85,height:34,objectFit:"contain",marginBottom:12}});
function clean(t:string){const text=t.replace(/[\u2010-\u2015]/g,"-").replace(/→/g,"->");assertCapabilityPdfText(text);return text;}
export function ReviewPDFDocument({delivery:d,branding:b}:{delivery:ReviewClientDocument;branding?:EffectiveBranding}){
  const brand=b?.enabled?b:undefined;
  if(brand?.agencyLogoData&&(brand.agencyLogoData.length>1500000||!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/i.test(brand.agencyLogoData)))throw Error("CAPABILITY_PDF_LOGO_INVALID");
  function check(v:unknown):void{if(typeof v==="string")clean(v);else if(Array.isArray(v))v.forEach(check);else if(v&&typeof v==="object")Object.values(v).forEach(check);}
  check(d);check([brand?.agencyName,brand?.clientName,brand?.footerNote]);
  const copy=(t:string,key?:React.Key)=><Text key={key} style={s.text}>{clean(t)}</Text>;
  return <Document title={clean(d.title)} author={clean(brand?.agencyName??"SearchTrust")}><Page size="A4" style={s.page} wrap>
    <Text style={s.meta}>SEARCHTRUST / VERIFIED REVIEW</Text>{brand?.agencyLogoData?<Image src={brand.agencyLogoData} style={s.logo}/>:null}
    <Text style={s.h1}>{clean(d.title)}</Text>{brand?.agencyName?copy(`Prepared by ${brand.agencyName}`):null}{brand?.clientName?copy(`Prepared for ${brand.clientName}`):null}
    <Text style={s.meta}>{clean(`${d.siteUrl} | ${d.market} | Report v${d.reportVersion} | Approved revision ${d.revision}`)}</Text>{copy(d.summary)}
    <Text style={s.h2} minPresenceAhead={64}>This period: work and observations</Text>{!d.observations.length?copy("No implementation actions were available for review. The diagnosis and limits remain part of this report."):null}
    {d.observations.map((o,i)=><View key={i}><Text style={s.h3} minPresenceAhead={45}>{clean(o.title)}</Text><Text style={s.meta}>{clean(o.target)}</Text>{o.lines.map((l,j)=>copy(l,j))}</View>)}
    <Text style={s.h2} minPresenceAhead={64}>Next work to agree</Text>{!d.actions.length?copy("No next action is proposed. Review the observations and open checks before agreeing further work."):null}
    {d.actions.map((a,i)=><View key={a.id}><Text style={s.h3} minPresenceAhead={45}>{clean(`${i+1}. ${a.title}`)}</Text>{copy(a.target)}{a.steps.map((l,j)=>copy(`${j+1}. ${l}`,j))}<Text style={s.h3} minPresenceAhead={45}>Completion checks</Text>{a.completion.map((l,j)=>copy(l,j))}{copy(a.review)}{a.materials.map((m,j)=><View key={j}><Text style={s.h3} minPresenceAhead={45}>{clean(m.title)}</Text>{copy(`Original material target: ${m.target} | ${m.readiness.replaceAll("_"," ")}`)}{copy(m.body)}{m.confirmation_items.map((l,k)=>copy(`Confirm: ${l}`,k))}</View>)}</View>)}
    <Text style={s.h2} minPresenceAhead={64}>Original diagnosis - retained for context</Text>{copy("These observations come from the earlier report and have not been rechecked here.")}
    {d.prior.map((p,i)=><View key={i}><Text style={s.h3} minPresenceAhead={45}>{clean(p.title)}</Text>{copy(p.summary)}{p.lines.map((l,j)=>copy(l,j))}</View>)}
    {d.clientNote?<View><Text style={s.h2} minPresenceAhead={64}>Note from your SEO</Text>{copy(d.clientNote)}</View>:null}
    <Text style={s.h2} minPresenceAhead={64}>Scope and limits</Text>{d.limitations.map((l,i)=>copy(l,i))}
    <View fixed style={s.footer}><Text style={{maxWidth:440}}>{clean(`${brand?.footerNote??"SearchTrust"} | Revision ${d.revision}`)}</Text><Text render={({pageNumber,totalPages})=>`${pageNumber} / ${totalPages}`}/></View>
  </Page></Document>;
}
export async function reviewPdfResponse(delivery:ReviewClientDocument,branding?:EffectiveBranding){
  const buffer=await renderToBuffer(<ReviewPDFDocument delivery={delivery} branding={branding}/>);
  return new Response(new Uint8Array(buffer),{headers:{...REVIEW_HEADERS,"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="SearchTrust-Review-${delivery.reportId}-r${delivery.revision}.pdf"`,"X-Report-Revision":String(delivery.revision),"X-Report-Content-Checksum":delivery.contentChecksum}});
}
