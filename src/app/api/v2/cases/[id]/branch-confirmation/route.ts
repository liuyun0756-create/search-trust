import {getCurrentUser} from "@/lib/auth";
import {createPreflightBranchHandler} from "@/lib/preflight-branch/handler";
import {requireV22PublicEntry} from "@/lib/release-v22/public-entry";
import {createServerClient} from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const POST = requireV22PublicEntry(createPreflightBranchHandler({
  user: getCurrentUser,
  key: () => process.env.V22_INTERNAL_API_TOKEN,
  save: (input) => createServerClient().rpc("save_v22_preflight_branch_confirmation", input),
}));
