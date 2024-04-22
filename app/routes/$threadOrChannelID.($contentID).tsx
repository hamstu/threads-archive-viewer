import {
  LoaderFunctionArgs,
  MetaFunction,
  redirect,
} from "@remix-run/cloudflare";
import { Auth } from "~/services/auth.server";
import MongoDataAPI from "~/services/mongo-data-api.server";
import { Channel, Thread } from "~/types/types";

export const meta: MetaFunction = () => {
  return [{ title: "Not Found - Threads Archive" }];
};

export async function loader({ request, context, params }: LoaderFunctionArgs) {
  // Check auth
  const auth = new Auth(context);
  await auth.requireUser(request);

  const threadOrChannelID = params.threadOrChannelID;
  const mongo = new MongoDataAPI(context);

  // Check if it's a channel
  const channel = await mongo.findOne<Channel>("channels", { filter: { channelID: threadOrChannelID } });
  if (channel) {
    return redirect(`/channel/${channel.channelID}`);
  }

  // Check if it's a thread
  const thread = await mongo.findOne<Thread>("threads", { filter: { threadID: threadOrChannelID } });
  if (thread) {
    let contentIDPart = '';
    if (params.contentID) {
      contentIDPart = `/${params.contentID}`;
    }
    return redirect(`/thread/${thread.threadID}${contentIDPart}`);
  }

  return null;
}

export default function ThreadOrChannel() {
  return <>
    <h1>Not found</h1>
    <p>Sorry, we couldn&apos;t find a thread or channel that matches the URL.</p>
    <p><a href="/">Go back to the home page</a></p>
  </>;
}
