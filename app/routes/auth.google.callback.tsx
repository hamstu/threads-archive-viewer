import { type LoaderFunctionArgs } from "@remix-run/cloudflare";
import { Auth } from "~/services/auth.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const auth = new Auth(context);
  return await auth.authenticate("google", request, {
    successRedirect: "/",
    failureRedirect: "/auth/login",
    throwOnError: true,
  });
}
