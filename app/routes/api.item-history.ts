import type { LoaderFunctionArgs } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { getItemById, getItemLogs, verifyStoreAccess } from "~/lib/queries";
import { resolveUserProfiles } from "~/lib/clerkUsers";
import type { ItemHistoryEntry } from "~/utils/helpers/itemHistory.helper";

/**
 * Item change history (resource route, no UI). `GET ?itemId=` → the item's
 * itemLogs with `loggedBy` resolved to display names. Owner/editor only — the
 * log records who did what, so it's planning data, not public. Loaded on demand
 * when the item detail popup opens.
 */
export async function loader(args: LoaderFunctionArgs) {
  const { userId } = await getAuth(args);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(args.request.url);
  const itemId = url.searchParams.get("itemId");
  if (!itemId) return Response.json({ error: "missing_item" }, { status: 400 });

  const item = await getItemById(itemId);
  if (!item) return Response.json({ error: "not_found" }, { status: 404 });

  const access = await verifyStoreAccess(item.storeId, userId);
  if (
    !access ||
    (access.accessLevel !== "owner" && access.accessLevel !== "editor")
  ) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const logs = await getItemLogs(itemId);
  const profiles = await resolveUserProfiles(
    args,
    logs.map((l) => l.loggedBy),
  );

  const entries: ItemHistoryEntry[] = logs.slice(0, 50).map((l) => ({
    delta: l.delta,
    note: l.note ?? null,
    loggedAt: l.loggedAt ? new Date(l.loggedAt).toISOString() : null,
    by: l.loggedBy ? (profiles[l.loggedBy]?.displayName ?? null) : null,
  }));

  return Response.json({ entries });
}
