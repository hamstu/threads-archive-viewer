import { LoaderFunctionArgs, redirect } from "@remix-run/cloudflare";
import { Form } from "@remix-run/react";
import { Auth } from "~/services/auth.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  // Redirect to the home page if the user is already logged in
  const auth = new Auth(context);
  const session = await auth.getSession(request);
  if (session.user) {
    return redirect("/");
  }
  return null;
}

export default function Login() {
  return (
    <Form action="/auth/google" method="post">
      <button>Login with Google</button>
    </Form>
  );
}
