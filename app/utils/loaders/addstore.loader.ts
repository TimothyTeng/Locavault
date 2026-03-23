import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { requireAuth } from "~/lib/auth";
import { createStoreWithBlocks } from "~/lib/queries";

export const loader = async (args: LoaderFunctionArgs) => {
  const userId = await requireAuth(args);
  return { userId };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const data = await request.json();
  await createStoreWithBlocks(data);
  return { ok: true };
};