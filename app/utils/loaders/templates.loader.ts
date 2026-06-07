import { getAuth } from "@clerk/react-router/server";
import {
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { requireAuth } from "~/lib/auth";
import {
  createStoreFromTemplate,
  createTemplateFromStore,
  deleteTemplate,
  getStoresByUser,
  getTemplatesForGallery,
  updateTemplateVisibility,
  verifyStoreOwner,
  verifyTemplateOwner,
} from "~/lib/queries";

export const loader = async (args: LoaderFunctionArgs) => {
  const userId = await requireAuth(args);
  const [templates, stores] = await Promise.all([
    getTemplatesForGallery(userId),
    getStoresByUser(userId),
  ]);
  return {
    userId,
    templates,
    stores: stores.map((s) => ({ id: s.id, name: s.name })),
  };
};

export const action = async (args: ActionFunctionArgs) => {
  const { userId } = await getAuth(args);
  if (!userId) throw new Response("Unauthorized", { status: 401 });

  const data = await args.request.json();

  // Create a new store from a template, then go to it
  if (data._action === "useTemplate") {
    const storeId = await createStoreFromTemplate(
      data.templateId,
      userId,
      data.name,
    );
    return redirect(`/store/${storeId}`);
  }

  // Snapshot one of the user's stores into a template
  if (data._action === "createFromStore") {
    await verifyStoreOwner(data.storeId, userId);
    await createTemplateFromStore(data.storeId, userId, {
      name: data.name,
      description: data.description ?? null,
      isPublic: !!data.isPublic,
    });
    return { ok: true };
  }

  // Toggle public/private (owner only)
  if (data._action === "setVisibility") {
    await verifyTemplateOwner(data.templateId, userId);
    await updateTemplateVisibility(data.templateId, !!data.isPublic);
    return { ok: true };
  }

  // Delete a template (owner only)
  if (data._action === "deleteTemplate") {
    await verifyTemplateOwner(data.templateId, userId);
    await deleteTemplate(data.templateId);
    return { ok: true };
  }

  throw new Response("Unknown action", { status: 400 });
};
