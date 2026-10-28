/** Actual product components mounted only in the isolated integration page. */
import React,{useEffect,useState} from "react";
import {createRoot} from "react-dom/client";
import {CapabilityOwnerEditor} from "../../src/components/report/CapabilityOwnerEditor";
import {CapabilityDeliveryActions} from "../../src/components/report/CapabilityDeliveryActions";
import {CapabilityReportDocument} from "../../src/components/report/CapabilityReportDocument";
import {SharedReportEntry} from "../../src/components/report/v22/shared-report-entry";
import {FirstServiceEntry} from "../../src/components/cases/first-service-entry";
import {ImplementationRecords} from "../../src/components/report/ImplementationRecords";
import type {loadCapabilityOwnerDocument} from "../../src/lib/report-capability/owner-document";
type Owner=NonNullable<Awaited<ReturnType<typeof loadCapabilityOwnerDocument>>>&{caseId:string;reportId:string};
function OwnerPage(){
  const [state,setState]=useState<Owner|null>(null);
  useEffect(()=>{
    const refresh=()=>{void fetch("/_journey/owner").then(r=>r.json()).then(setState);};
    refresh();window.addEventListener("journey-refresh",refresh);return()=>window.removeEventListener("journey-refresh",refresh);
  },[]);
  if(!state)return <p>Loading local report…</p>;
  return <main><CapabilityReportDocument document={state.document}/><CapabilityOwnerEditor initial={state.editable} orderConstraints={state.orderConstraints}/>
    <CapabilityDeliveryActions caseId={state.caseId} reportId={state.reportId} revision={state.deliveryRevision} approved={state.hasApproved}/>
    {state.implementationRevisionId && new URLSearchParams(window.location.search).get('implementation')==='1'
      ?<ImplementationRecords caseId={state.caseId} reportId={state.reportId} deliveryRevisionId={state.implementationRevisionId}/>:null}</main>;
}
const query=new URLSearchParams(window.location.search);
createRoot(document.getElementById("root")!).render(window.location.pathname==="/_entry"
  ?<FirstServiceEntry caseId={query.get('case')!} ownerId={query.get('owner')!} planningEnabled={query.get('planning')==='1'}/>
  :window.location.pathname==="/share"?<SharedReportEntry/>:<OwnerPage/>);
