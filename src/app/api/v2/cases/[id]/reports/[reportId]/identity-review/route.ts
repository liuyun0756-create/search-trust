import {getCurrentUser} from '@/lib/auth';
import {createIdentityReviewHandler} from '@/lib/identity-review/handler';
export const dynamic='force-dynamic';
export const POST=createIdentityReviewHandler({enabled:()=>process.env.V22_CAPABILITY_DISPATCH_ENABLED==='true',user:getCurrentUser,config:()=>process.env.V22_API_BASE_URL&&process.env.V22_INTERNAL_API_TOKEN?{baseUrl:process.env.V22_API_BASE_URL,token:process.env.V22_INTERNAL_API_TOKEN}:null});
