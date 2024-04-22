import {
  LoaderFunctionArgs,
  json,
  type MetaFunction,
} from "@remix-run/cloudflare";
import { Form, useLoaderData } from "@remix-run/react";
import { Auth } from "~/services/auth.server";
import MongoDataAPI from "~/services/mongo-data-api.server";
import { Thread } from "~/types/types";
// import { Pagination } from "~/components/Pagination";
import { ThreadsList } from "~/components/ThreadsList";

export const THREADS_PER_PAGE = 20;

export async function loader({ request, context }: LoaderFunctionArgs) {
  // Check auth
  const auth = new Auth(context);
  const user = await auth.requireUser(request);

  const url = new URL(request.url);
  const q = url.searchParams.get("q") || null;
  const sort =
    (url.searchParams.get("sort") as "relevance" | "newest" | "oldest") ||
    "relevance";

  // Fetch channel threads
  const mongo = new MongoDataAPI(context);

  let threads: Thread[] = [];
  if (q) {
    threads = await mongo.search<Thread>("threads", q, sort);
  }

  const cdnHost = context.cloudflare.env.CDN_HOST;

  return json({ user, threads, q, sort, cdnHost });
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  return [{ title: `Search for '${data?.q}' - Threads Archive` }];
};

export default function Index() {
  const { threads, cdnHost, q, sort } = useLoaderData<typeof loader>();
  return (
    <>
      <h1>Search Results</h1>
      <Form method="get" action="/search" className="sortForm">
        <select
          name="sort"
          value={sort}
          onChange={(event) => {
            event.target.form?.submit();
          }}
        >
          <input type="hidden" name="q" value={q || ""} />
          <option value="relevance">Relevance</option>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
        </select>
      </Form>
      <p>Searching for &quot;{q}&quot;</p>
      <ThreadsList threads={threads} cdnHost={cdnHost} />
      {/* <Pagination pageNumber={pageNumber} threadsCount={threadsCount} /> */}
    </>
  );
}
