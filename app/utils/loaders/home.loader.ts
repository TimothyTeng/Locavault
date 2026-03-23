import { getAuth } from "@clerk/react-router/server";
import { deleteStore, getStoresByUserWithDetails, getStoresMemberOf, verifyStoreOwner } from "~/lib/queries";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

export async function loader(args: LoaderFunctionArgs) {
  const { userId } = await getAuth(args);
  if (!userId) return { stores: [] };

  const [ownedStores, memberStores] = await Promise.all([
    getStoresByUserWithDetails(userId),
    getStoresMemberOf(userId),
  ]);

  const stores = [
    ...ownedStores.map((s) => ({ ...s, role: "owner" as const })),
    ...memberStores,
  ];

  return { stores };
}

// ── Action ─────────────────────────────────────────────────

export async function action(args: ActionFunctionArgs) {
  const { userId } = await getAuth(args);
  if (!userId) throw new Response("Unauthorized", { status: 401 });

  const formData = await args.request.formData();
  const _action = formData.get("_action");

  if (_action === "deleteStore") {
    const storeId = String(formData.get("storeId"));
    await verifyStoreOwner(storeId, userId);
    await deleteStore(storeId);
    return { ok: true };
  }

  throw new Response("Unknown action", { status: 400 });
}