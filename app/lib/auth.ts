
import { getAuth } from "@clerk/react-router/server";
import { redirect, type LoaderFunctionArgs } from "react-router";

export async function requireAuth(args:LoaderFunctionArgs) {
  const { userId } = await getAuth(args);
  if (!userId) throw redirect("/");
  return userId;
}