import { getAuth } from "@clerk/react-router/server";
import {
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { claimInvite, getInviteByToken, getStoreById } from "~/lib/queries";

// The loader NEVER mutates: joining a store is a side effect, so it happens only
// on an explicit POST (the confirm button), not on navigating to / prefetching
// the link. The loader just resolves the invite's display state.
export async function loader(args: LoaderFunctionArgs) {
  const { params } = args;
  const token = params.token!;
  const { userId } = await getAuth(args);

  const invite = await getInviteByToken(token);
  if (!invite) return { status: "not_found" as const };
  if (invite.claimedAt) return { status: "claimed" as const };
  if (new Date() > invite.expiresAt) return { status: "expired" as const };

  // Not signed in — show the sign-in prompt.
  if (!userId) return { status: "requires_auth" as const };

  // Signed in and valid — show a "Join {store}?" confirmation.
  const store = await getStoreById(invite.storeId);
  return { status: "ready" as const, storeName: store?.name ?? "this store" };
}

// Claim on POST only, then redirect into the store.
export async function action(args: ActionFunctionArgs) {
  const { params } = args;
  const token = params.token!;
  const { userId } = await getAuth(args);
  if (!userId) throw new Response("Unauthorized", { status: 401 });

  const invite = await getInviteByToken(token);
  if (!invite) throw redirect("/");

  let storeId: string;
  try {
    storeId = await claimInvite(token, userId);
  } catch {
    // Already a member / owner / race — just send them to the store.
    throw redirect(`/store/${invite.storeId}`);
  }
  throw redirect(`/store/${storeId}`);
}
