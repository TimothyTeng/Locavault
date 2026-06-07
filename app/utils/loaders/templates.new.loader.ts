import { getAuth } from "@clerk/react-router/server";
import {
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { requireAuth } from "~/lib/auth";
import { createTemplate } from "~/lib/queries";
import type { BlockDetails } from "~/types/storeViewFinderTypes";

export const loader = async (args: LoaderFunctionArgs) => {
  const userId = await requireAuth(args);
  return { userId };
};

export const action = async (args: ActionFunctionArgs) => {
  const { userId } = await getAuth(args);
  if (!userId) throw new Response("Unauthorized", { status: 401 });

  const data = await args.request.json();

  const id = await createTemplate({
    name: data.name,
    userId,
    description: data.description ?? null,
    tags: data.tags ?? "[]",
    rows: data.rows,
    cols: data.cols,
    isPublic: !!data.isPublic,
    blocks: (data.blocks ?? []) as BlockDetails[],
  });

  return redirect(`/templates?created=${id}`);
};
