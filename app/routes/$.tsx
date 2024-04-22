import { LoaderFunctionArgs, type MetaFunction } from "@remix-run/cloudflare";
import { Auth } from "~/services/auth.server";

export const meta: MetaFunction = () => {
  return [{ title: "Not Found - Threads Archive" }];
};

export async function loader({ request, context }: LoaderFunctionArgs) {
  // Check auth
  const auth = new Auth(context);
  await auth.requireUser(request);

  return null;
}

export default function Index() {
  return (
    <>
      <h1>Not Found</h1>
      <p>Oops! There is nothing here. Check the URL again?</p>
    </>
  );
}
