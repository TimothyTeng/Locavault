import { getAuth } from "@clerk/react-router/server";
import { redirect, type LoaderFunctionArgs } from "react-router";
import { claimInvite, getInviteByToken } from "~/lib/queries";

export async function loader(args: LoaderFunctionArgs) {
  const { params } = args;
  const token = params.token!;
  const { userId } = await getAuth(args);

  const invite = await getInviteByToken(token);
  if (!invite) return { status: "not_found" as const };
  if (invite.claimedAt) return { status: "claimed" as const };
  if (new Date() > invite.expiresAt) return { status: "expired" as const };

  // Not signed in — show page with sign-in prompt
  if (!userId) return { status: "requires_auth" as const };

  // Signed in — claim and redirect to the store
  try {
    const storeId = await claimInvite(token, userId);
    throw redirect(`/store/${storeId}`);
  } catch (err) {
    if (err instanceof Response && err.status === 302) throw err;
    throw redirect(`/store/${invite.storeId}`);
  }
}