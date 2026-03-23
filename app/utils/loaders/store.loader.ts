import { getAuth } from "@clerk/react-router/server";
import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import { createInvite, createItem, getItemsByStore, getMembersByStore, removeMember, updateItem, updateItemVisibility, updateStoreVisibility, verifyStoreAccess } from "~/lib/queries";

export const loader = async (args: LoaderFunctionArgs) => {
  const { userId } = await getAuth(args);
  const { params } = args;

  const access = await verifyStoreAccess(params.id!, userId ?? null);

  if (!access) throw redirect("/");

  const { store, accessLevel } = access;

  if (accessLevel === "none") throw redirect("/");

  const [allItems, members] = await Promise.all([
    getItemsByStore(params.id!),
    accessLevel === "owner"
      ? getMembersByStore(params.id!)
      : Promise.resolve([]),
  ]);

  const items =
    accessLevel === "public" || accessLevel === "viewer"
      ? allItems.filter((i) => i.isPublic)
      : allItems;

  return { accessLevel, store, items, members, userId };
};

// ── Action ─────────────────────────────────────────────────
export const action = async (args: ActionFunctionArgs) => {
  const { request, params } = args;
  const { userId } = await getAuth(args);
  if (!userId) throw new Response("Unauthorized", { status: 401 });

  const data = await request.json();

  if (data._action === "createItem") {
    const newItem = await createItem({
      name: data.name,
      storeId: params.id!,
      quantity: data.quantity,
      description: data.description,
      blockId: data.blockId ?? undefined,
    });
    return { ok: true, id: newItem.id, optimisticId: data.optimisticId };
  }

  if (data._action === "updateItem") {
    await updateItem(data.id, {
      name: data.name,
      quantity: data.quantity,
      description: data.description,
      storeId: data.storeId,
      blockId: data.blockId,
    });
    return { ok: true };
  }

  if (data._action === "removeMember") {
    await removeMember(params.id!, data.userId);
    return { ok: true };
  }

  if (data._action === "createInvite") {
    const token = await createInvite(params.id!, "editor", userId);
    return { ok: true, token };
  }

  if (data._action === "updateVisibility") {
    await updateStoreVisibility(params.id!, {
      isPublic: data.isPublic,
      canvasVisible: data.canvasVisible,
    });
    return { ok: true };
  }

  if (data._action === "updateItemVisibility") {
    await updateItemVisibility(data.itemId, data.isPublic);
    return { ok: true };
  }

  return { ok: false };
};