import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isFirstServiceSetupEnabled } from "@/lib/first-service-setup/config";
import { FirstServiceClient } from "@/components/cases/first-service-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Prepare a client | SearchTrust", robots: { index: false, follow: false } };

export default async function NewServiceClientPage() {
  if (!isFirstServiceSetupEnabled()) notFound();
  if (!await getCurrentUser()) redirect("/sign-in?redirect_url=%2Fcases%2Fservice%2Fnew");
  return <main className="min-h-screen bg-[#f7faf7] px-5 py-12 text-[#1d2a22] sm:px-8"><div className="mx-auto max-w-6xl">
    <Link href="/cases/service/prepare" className="mb-8 inline-block text-sm font-semibold underline">← Choose an existing client instead</Link>
    <FirstServiceClient />
  </div></main>;
}
