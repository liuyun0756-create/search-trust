import { getCurrentUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";
import { isV22PublicEntryEnabled } from "@/lib/release-v22/public-entry";
import { isFirstServiceEntryAvailable } from "@/lib/first-service-setup/entry-config";
import { FirstServiceEntryRepository } from "@/lib/first-service-setup/entry-server";
import { createFirstServiceEntryHandlers } from "@/lib/first-service-setup/entry-handler";
import { isPlanningSettingsEnabled } from "@/lib/planning-settings/config";

export const dynamic = "force-dynamic";
export const { GET, POST } = createFirstServiceEntryHandlers({
  enabled: isFirstServiceEntryAvailable,
  intakeEnabled: isV22PublicEntryEnabled,
  user: getCurrentUser,
  repository: () =>
    new FirstServiceEntryRepository(
      createServerClient(),
      isPlanningSettingsEnabled(),
    ),
});
