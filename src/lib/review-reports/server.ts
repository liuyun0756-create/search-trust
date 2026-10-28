import "server-only";
import {getCurrentUser} from "../auth";
import {createServerClient} from "../supabase";
import {isReviewDeliveryEnabled} from "./config";
import {ReviewDeliveryRepository} from "./repository";
import {ReviewShareService} from "./shares";
import {createReviewDeliveryHandlers} from "./handlers";
import {reviewPdfResponse} from "./pdf";
export const reviewDeliveryHandlers=createReviewDeliveryHandlers({getCurrentUser,isEnabled:isReviewDeliveryEnabled,
  repository:()=>new ReviewDeliveryRepository(createServerClient()),shares:()=>new ReviewShareService(new ReviewDeliveryRepository(createServerClient())),pdf:reviewPdfResponse});
