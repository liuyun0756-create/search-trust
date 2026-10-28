import {getCurrentUser} from "@/lib/auth";
import {createServerClient} from "@/lib/supabase";
import {isImplementationRecordsEnabled} from "@/lib/implementation-records/config";
import {ImplementationRepository} from "@/lib/implementation-records/repository";
import {createImplementationHandlers} from "@/lib/implementation-records/handler";
export const dynamic = "force-dynamic";
export const {GET, PUT} = createImplementationHandlers({enabled: isImplementationRecordsEnabled, user: getCurrentUser,
  repository: () => new ImplementationRepository(createServerClient())});
