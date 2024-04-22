import {
  LoaderFunctionArgs,
  json,
  type MetaFunction,
} from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { Auth } from "~/services/auth.server";
import MongoDataAPI from "~/services/mongo-data-api.server";
import { Thread } from "~/types/types";
import { Pagination } from "~/components/Pagination";
import { ThreadsList } from "~/components/ThreadsList";

export const THREADS_PER_PAGE = 20;

export async function loader({ request, context, params }: LoaderFunctionArgs) {
  // Check auth
  const auth = new Auth(context);
  const user = await auth.requireUser(request);

  const url = new URL(request.url);
  const pageParam = url.searchParams.get("page") || "1";

  // Fetch channel threads
  const mongo = new MongoDataAPI(context);
  const channel = await mongo.findOne<{
    _id: string;
    channelID: string;
    name: string;
  }>("channels", { filter: { channelID: params.channelID } });

  const threadsCount = await mongo.count("threads", {
    channelID: params.channelID,
  });
  const pageNumber = pageParam ? parseInt(pageParam) : 1;
  const threads = await mongo.find<Thread>("threads", {
    filter: { channelID: params.channelID },
    sort: { createdAt: -1 },
    limit: THREADS_PER_PAGE,
    skip: (pageNumber - 1) * THREADS_PER_PAGE,
  });

  const cdnHost = context.cloudflare.env.CDN_HOST;

  return json({ user, channel, threads, threadsCount, pageNumber, cdnHost });
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  return [{ title: `#${data?.channel.name} - Threads Archive` }];
};

export default function Index() {
  const { channel, threads, threadsCount, pageNumber, cdnHost } =
    useLoaderData<typeof loader>();
  return (
    <>
      <h1>#{channel?.name}</h1>
      <p>
        There are {threadsCount} threads in this channel. You are on page{" "}
        {pageNumber} of {Math.ceil(threadsCount / THREADS_PER_PAGE)}.
      </p>
      <ThreadsList threads={threads} cdnHost={cdnHost} />
      <Pagination pageNumber={pageNumber} threadsCount={threadsCount} />
    </>
  );
}
