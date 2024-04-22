import {
  Form,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  json,
  useLoaderData,
  useNavigation,
  useRouteError,
} from "@remix-run/react";
import { Auth } from "./services/auth.server";
import { LoaderFunctionArgs } from "@remix-run/cloudflare";
import * as Tooltip from "@radix-ui/react-tooltip";

import "~/css/index.css";
import "~/css/tooltips.css";
import SearchIcon from "./components/SearchIcon";
import { getUserByEmail } from "./services/users";

// app/root.tsx
export async function loader({ request, context }: LoaderFunctionArgs) {
  const auth = new Auth(context);
  const user = await auth.readUser(request);
  const url = new URL(request.url);
  const q = url.searchParams.get("q") || null;

  const cdnHost = context.cloudflare.env.CDN_HOST;
  const threadsUser = getUserByEmail(user.email, cdnHost);

  return json({ user, threadsUser, q });
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, threadsUser, q } = useLoaderData<typeof loader>();
  const { state } = useNavigation();
  const error = useRouteError();

  if (error) {
    return <h1>ERROR</h1>;
  }

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <Tooltip.Provider
          disableHoverableContent={false}
          skipDelayDuration={100}
          delayDuration={100}
        >
          <header>
            <div className="header-left">
              <div className="navItem">
                <a href="/">
                  <b>
                    Buffer Threads <span className="header-sup">Archive</span>
                  </b>
                </a>
              </div>
              <div className="navItem hiddenOnMobile">
                <a href="/">Home</a>
              </div>
              {threadsUser && (
                <div className="navItem hiddenOnMobile">
                  <a href={`/user/${threadsUser.id}`}>My Threads</a>
                </div>
              )}
            </div>
            <div className="header-right">
              <Form method="get" action="/search" className="searchForm">
                <input
                  className="searchInput"
                  type="search"
                  name="q"
                  placeholder="Search"
                  aria-label="Search"
                  defaultValue={q || ""}
                />
              </Form>
            </div>
          </header>
          <div className={`wrapper ${state === "loading" ? "loading" : ""}`}>
            {children}
            <ScrollRestoration />
            <Scripts />
          </div>
        </Tooltip.Provider>
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}
