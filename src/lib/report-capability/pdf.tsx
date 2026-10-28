import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { CapabilityReportPDFDocument } from "@/components/report/pdf/CapabilityReportPDFDocument";
import type { ApprovedCapabilityDelivery } from "./delivery";
import type { EffectiveBranding } from "../report-pdf/branding";

export const CAPABILITY_DELIVERY_HEADERS={"Cache-Control":"private, no-store, max-age=0","Referrer-Policy":"no-referrer","X-Robots-Tag":"noindex, nofollow, noarchive"};
export async function capabilityPdfResponse(delivery:ApprovedCapabilityDelivery,branding?:EffectiveBranding) {
  const buffer=await renderToBuffer(CapabilityReportPDFDocument({delivery,branding}));
  return new Response(new Uint8Array(buffer),{headers:{...CAPABILITY_DELIVERY_HEADERS,"Content-Type":"application/pdf",
    "Content-Disposition":`attachment; filename="SearchTrust-${delivery.reportId}-r${delivery.revision}.pdf"`,
    "X-Report-Revision":String(delivery.revision),"X-Report-Content-Checksum":delivery.contentChecksum}});
}
