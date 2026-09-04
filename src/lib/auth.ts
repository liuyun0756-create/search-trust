import { auth, clerkClient } from "@clerk/nextjs/server";
import { createServerClient } from "@/lib/supabase";

export async function getCurrentUser() {
  const session = await auth();
  const clerkUserId = session.userId;
  if (!clerkUserId) {
    console.warn("Current user resolution failed", {
      stage: "clerk_session",
      code: "CLERK_SESSION_MISSING",
    });
    return null;
  }

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("users")
    .select("id, audit_credits")
    .eq("clerk_user_id", clerkUserId)
    .single();

  if (data) return { userId: data.id, clerkUserId, auditCredits: data.audit_credits };
  if (error?.code && error.code !== "PGRST116") {
    console.error("Current user resolution failed", {
      stage: "supabase_lookup",
      code: error.code,
    });
  }

  // 兜底：webhook 未触发时手动创建用户
  let email = "";
  let name: string | null = null;
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(clerkUserId);
    email = user.emailAddresses?.[0]?.emailAddress || "";
    name = [user.firstName, user.lastName].filter(Boolean).join(" ") || null;
  } catch (error) {
    console.error("Current user resolution failed", {
      stage: "clerk_profile",
      code: error instanceof Error ? error.name : "UNKNOWN_ERROR",
    });
  }

  const { data: newUser, error: insertError } = await supabase
    .from("users")
    .insert({ clerk_user_id: clerkUserId, email, name, audit_credits: 5 })
    .select("id, audit_credits")
    .single();

  if (insertError) {
    console.error("Current user resolution failed", {
      stage: "supabase_insert",
      code: insertError.code,
    });
  }

  return newUser ? { userId: newUser.id, clerkUserId, auditCredits: newUser.audit_credits } : null;
}
