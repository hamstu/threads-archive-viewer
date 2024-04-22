import type { ActionFunctionArgs } from "@remix-run/cloudflare";
import { Auth } from "~/services/auth.server";

export async function action({ request, context }: ActionFunctionArgs) {
  const auth = new Auth(context);
  return await auth.authenticate("google", request);
}
