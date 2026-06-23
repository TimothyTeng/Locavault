import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { requireAuth } from "~/lib/auth";
import { createStoreWithBlocks, getCustomFixturesByUser } from "~/lib/queries";
import { requireText, toQty } from "~/utils/helpers/validate.helper";

export const loader = async (args: LoaderFunctionArgs) => {
  const userId = await requireAuth(args);
  const customFixtures = await getCustomFixturesByUser(userId);
  return { userId, customFixtures };
};

export const action = async (args: ActionFunctionArgs) => {
  // Authenticate, and force the owner to the signed-in user — never trust a
  // client-supplied userId. Validate the shape so a store can't be created
  // nameless or with an absurd grid / unbounded block count.
  const userId = await requireAuth(args);
  const data = await args.request.json();

  const blocks = Array.isArray(data.blocks) ? data.blocks.slice(0, 2000) : [];
  const walls = Array.isArray(data.walls) ? data.walls.slice(0, 5000) : [];

  await createStoreWithBlocks({
    ...data,
    userId,
    name: requireText(data.name, "Store name", 120),
    rows: toQty(data.rows, 10, { min: 1, max: 200 }),
    cols: toQty(data.cols, 10, { min: 1, max: 200 }),
    blocks,
    walls,
  });
  return { ok: true };
};
