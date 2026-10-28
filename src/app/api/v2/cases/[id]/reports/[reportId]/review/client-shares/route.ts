import {reviewDeliveryHandlers} from "@/lib/review-reports/server";
export const runtime="nodejs";
export const GET=reviewDeliveryHandlers.list;
export const POST=reviewDeliveryHandlers.create;
