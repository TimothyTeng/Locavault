import { getAuth as clerkGetAuth } from "@clerk/react-router/server";
import { redirect } from "react-router";

type GetAuthArgs = Parameters<typeof clerkGetAuth>[0];

/**
 * Thin wrapper over Clerk's `getAuth` so loaders/actions import auth from one place
 * (alongside `requireAuth`). Returns just `{ userId }` since that's all callers use;
 * `userId` is `null` for an unauthenticated request.
 */
export async function getAuth(
  args: GetAuthArgs,
): Promise<{ userId: string | null }> {
  const { userId } = await clerkGetAuth(args);
  return { userId: userId ?? null };
}

/** Resolve the signed-in user id, or redirect to the landing page if signed out. */
export async function requireAuth(args: GetAuthArgs) {
  const { userId } = await getAuth(args);
  if (!userId) throw redirect("/");
  return userId;
}
