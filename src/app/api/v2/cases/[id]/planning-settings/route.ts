import {getCurrentUser} from "@/lib/auth";
import {createServerClient} from "@/lib/supabase";
import {isPlanningSettingsEnabled} from "@/lib/planning-settings/config";
import {PlanningSettingsRepository} from "@/lib/planning-settings/repository";
import {createPlanningSettingsHandlers} from "@/lib/planning-settings/handler";
export const dynamic="force-dynamic";
export const {GET,PUT}=createPlanningSettingsHandlers({enabled:isPlanningSettingsEnabled,user:getCurrentUser,
  repository:()=>new PlanningSettingsRepository(createServerClient())});
