import { ActionFunctionArgs, redirect } from "@remix-run/cloudflare";
import { Auth } from "~/services/auth.server";

export async function action({ request, context }: ActionFunctionArgs) {
  const auth = new Auth(context);
  throw redirect("/", {
    headers: { "set-cookie": await auth.clear(request) },
  });
}
