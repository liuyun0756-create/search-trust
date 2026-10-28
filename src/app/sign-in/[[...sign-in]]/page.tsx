import { SignIn } from "@clerk/nextjs";
import { SignInExperience } from "@/components/auth/sign-in-experience";
import { isLocalE2ETestMode } from "@/lib/e2e-v22/config";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ redirect_url?: string }> }) {
  const { redirect_url: redirectUrl } = await searchParams;
  const fallback = redirectUrl === "/cases/service" ? "/cases/service" : "/cases/new";
  const authPanel = isLocalE2ETestMode() ? (
    <div data-testid="synthetic-sign-in" className="rounded-[22px] border border-[#dce1d7] bg-white p-5 shadow-[0_12px_35px_rgba(35,48,36,0.06)]">
      <h3 className="text-xl font-black tracking-[-0.035em] text-[#172019]">Sign in to SearchTrust</h3>
      <p className="mt-2 text-sm text-[#737d72]">Continue with your Google account or email.</p>
      <button type="button" disabled className="mt-5 w-full rounded-xl border border-[#dce1d7] px-4 py-3 text-sm font-bold text-[#344034]">Continue with Google</button>
      <div className="my-5 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#9aa198]"><span className="h-px flex-1 bg-[#e3e7df]" /><span>or</span><span className="h-px flex-1 bg-[#e3e7df]" /></div>
      <div className="rounded-xl border border-[#dce1d7] bg-[#f8faf6] px-4 py-3 text-sm text-[#9aa198]">Email address</div>
      <button type="button" disabled className="mt-3 w-full rounded-xl bg-[#172019] px-4 py-3 text-sm font-bold text-white">Continue</button>
      <p className="mt-5 text-center text-xs text-[#7f887d]">No account? <span className="font-bold text-[#647b19]">Sign up</span></p>
    </div>
  ) : (
    <SignIn
      fallbackRedirectUrl={fallback}
      signUpFallbackRedirectUrl={fallback}
      appearance={{
        variables: {
          colorPrimary: "#172019",
          colorText: "#172019",
          colorTextSecondary: "#6f796d",
          colorBackground: "#ffffff",
          borderRadius: "0.875rem",
          fontFamily: "inherit",
        },
        elements: {
          rootBox: "w-full",
          cardBox: "w-full shadow-none",
          card: "w-full bg-transparent p-0 shadow-none",
          headerTitle: "text-[#172019] font-black tracking-[-0.03em]",
          headerSubtitle: "text-[#737d72]",
          socialButtonsBlockButton: "border-[#dce1d7] shadow-none hover:bg-[#f4f6f1]",
          formButtonPrimary: "bg-[#172019] hover:bg-[#2a372c] shadow-none normal-case font-bold",
          footerActionLink: "text-[#647b19] font-bold",
          formFieldInput: "border-[#dce1d7] bg-[#f8faf6] shadow-none focus:border-[#8aaa1e]",
          dividerLine: "bg-[#e3e7df]",
        },
      }}
    />
  );

  return (
    <SignInExperience authPanel={authPanel} />
  );
}
