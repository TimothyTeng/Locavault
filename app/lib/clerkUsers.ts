import { clerkClient } from "@clerk/react-router/server";
import type { UserProfile } from "~/types/memberTypes";

type Args = Parameters<typeof clerkClient>[0];

/**
 * Resolve Clerk user ids to their public display name + avatar in one call. Used
 * to turn raw `userId`s (store members, `itemLogs.loggedBy`) into human labels.
 * Degrades to an empty map on any failure — a name lookup must never break a
 * loader. Deduped; a single `getUserList` batch.
 */
export async function resolveUserProfiles(
  args: Args,
  ids: (string | null | undefined)[],
): Promise<Record<string, UserProfile>> {
  const unique = [...new Set(ids.filter((v): v is string => !!v))];
  if (unique.length === 0) return {};
  try {
    const client = clerkClient(args);
    const res = await client.users.getUserList({
      userId: unique,
      limit: Math.min(unique.length, 500),
    });
    const out: Record<string, UserProfile> = {};
    for (const u of res.data) {
      const name =
        [u.firstName, u.lastName].filter(Boolean).join(" ").trim() ||
        u.username ||
        u.primaryEmailAddress?.emailAddress ||
        u.emailAddresses?.[0]?.emailAddress ||
        u.id;
      out[u.id] = { displayName: name, imageUrl: u.imageUrl ?? null };
    }
    return out;
  } catch {
    return {};
  }
}
