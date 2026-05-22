import { auth, clerkClient } from "@clerk/nextjs/server";
import { createServerClient } from "@/lib/supabase";

export async function getCurrentUser() {
  const session = await auth();
  const clerkUserId = session.userId;
  if (!clerkUserId) return null;

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("users")
    .select("id, audit_credits")
    .eq("clerk_user_id", clerkUserId)
    .single();

  if (data) return { userId: data.id, auditCredits: data.audit_credits };

  // 兜底：webhook 未触发时手动创建用户
  let email = "";
  let name: string | null = null;
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(clerkUserId);
    email = user.emailAddresses?.[0]?.emailAddress || "";
    name = [user.firstName, user.lastName].filter(Boolean).join(" ") || null;
  } catch {}

  const { data: newUser } = await supabase
    .from("users")
    .insert({ clerk_user_id: clerkUserId, email, name, audit_credits: 1 })
    .select("id, audit_credits")
    .single();

  return newUser ? { userId: newUser.id, auditCredits: newUser.audit_credits } : null;
}
