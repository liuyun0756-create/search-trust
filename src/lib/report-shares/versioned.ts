import "server-only";
import { createServerReportShareService } from "./server";
import { ReportShareNotFoundError } from "./service";
import { CapabilityShareService } from "../report-capability/shares";
import { createServerClient } from "../supabase";
import {isReviewDeliveryEnabled} from "../review-reports/config";
import {ReviewShareService} from "../review-reports/shares";
import {ReviewDeliveryRepository} from "../review-reports/repository";
export async function resolveVersionedShare(token:string) {
  try{return {kind:"legacy" as const,value:await createServerReportShareService().resolve(token)};}
  catch(error){if(!(error instanceof ReportShareNotFoundError))throw error;}
  if(process.env.V22_CAPABILITY_DISPATCH_ENABLED!=="true")throw new ReportShareNotFoundError();
  if(isReviewDeliveryEnabled()){
    try{return {kind:"review" as const,value:await new ReviewShareService(new ReviewDeliveryRepository(createServerClient())).resolve(token)};}
    catch(error){if(!(error instanceof ReportShareNotFoundError))throw error;}
  }
  return {kind:"capability" as const,value:await new CapabilityShareService(createServerClient()).resolve(token)};
}
