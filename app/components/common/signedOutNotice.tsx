import { SignInButton } from "@clerk/react-router";

/**
 * Full-screen "please sign in" state for auth-gated routes, with a real
 * sign-in affordance instead of a dead-end line of text.
 */
export function SignedOutNotice({
  message = "You must be signed in to continue.",
}: {
  message?: string;
}) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 px-6 text-center font-mono">
      <p className="text-xs text-slate-400">{message}</p>
      <SignInButton mode="modal">
        <button className="rounded-md border border-slate-800 bg-slate-800 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-slate-700">
          Sign in
        </button>
      </SignInButton>
    </div>
  );
}
