import { redirect, type LoaderFunctionArgs, useLoaderData } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { useClerk } from "@clerk/react-router";
import { getInviteByToken, claimInvite } from "~/lib/queries";
import Navbar from "~/components/home/navbar";
export { loader } from "#utils/loaders/invite.loader";
import type { loader } from "#utils/loaders/invite.loader";

// ── Page ───────────────────────────────────────────────────
export default function InvitePage() {
  const data = useLoaderData<typeof loader>();
  const { openSignIn } = useClerk();

  const errorMessages = {
    not_found: {
      title: "Invite not found",
      body: "This invite link doesn't exist or has been deleted.",
    },
    claimed: {
      title: "Invite already used",
      body: "This invite link has already been claimed. Ask the store owner for a new one.",
    },
    expired: {
      title: "Invite expired",
      body: "This invite link has expired. Ask the store owner to generate a new one.",
    },
  };

  if (data.status === "requires_auth") {
    return (
      <div>
        <Navbar />
        <div className="flex flex-col items-center justify-center h-screen w-full gap-4">
          <p className="text-slate-800 font-mono text-sm font-bold">
            You've been invited
          </p>
          <p className="text-slate-400 font-mono text-[11px]">
            Sign in to claim your invite and access the store.
          </p>
          <button
            onClick={() =>
              openSignIn({
                // After sign-in, Clerk reloads the current URL
                // — the loader runs again with a userId and claims the invite
                fallbackRedirectUrl: window.location.href,
                signUpFallbackRedirectUrl: window.location.href,
              })
            }
            className="flex items-center gap-1.5 px-4 py-2 rounded-md border border-slate-300 text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-800 hover:text-white hover:border-slate-800 transition-all duration-150"
          >
            Sign in to claim invite
          </button>
        </div>
      </div>
    );
  }

  const msg =
    data.status in errorMessages
      ? errorMessages[data.status as keyof typeof errorMessages]
      : { title: "Something went wrong", body: "Please try again." };

  return (
    <div>
      <Navbar />
      <div className="flex flex-col items-center justify-center h-screen w-full gap-3">
        <p className="text-slate-800 font-mono text-sm font-bold">
          {msg.title}
        </p>
        <p className="text-slate-400 font-mono text-[11px]">{msg.body}</p>
      </div>
    </div>
  );
}
