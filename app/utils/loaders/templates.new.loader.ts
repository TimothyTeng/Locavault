import { getAuth } from "~/lib/auth";
import {
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { requireAuth } from "~/lib/auth";
import { createTemplate, getCustomFixturesByUser } from "~/lib/queries";
import type { Wall } from "~/types/wallTypes";
import {
  requireText,
  optText,
  toQty,
  validateBlocks,
} from "~/utils/helpers/validate.helper";

export const loader = async (args: LoaderFunctionArgs) => {
  const userId = await requireAuth(args);
  const customFixtures = await getCustomFixturesByUser(userId);
  return { userId, customFixtures };
};

export const action = async (args: ActionFunctionArgs) => {
  const { userId } = await getAuth(args);
  if (!userId) throw new Response("Unauthorized", { status: 401 });

  const data = await args.request.json();

  const id = await createTemplate({
    name: requireText(data.name, "Template name", 120),
    userId,
    description: optText(data.description),
    tags: typeof data.tags === "string" ? data.tags.slice(0, 2000) : "[]",
    rows: toQty(data.rows, 10, { min: 1, max: 200 }),
    cols: toQty(data.cols, 10, { min: 1, max: 200 }),
    isPublic: !!data.isPublic,
    blocks: validateBlocks(data.blocks),
    walls: (Array.isArray(data.walls)
      ? data.walls.slice(0, 5000)
      : []) as Wall[],
  });

  return redirect(`/templates?created=${id}`);
};
