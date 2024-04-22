import {
  LoaderFunctionArgs,
  json,
  type MetaFunction,
} from "@remix-run/cloudflare";
import { Link, useLoaderData } from "@remix-run/react";
import { Auth } from "~/services/auth.server";
import MongoDataAPI from "~/services/mongo-data-api.server";
import { convertEmojiCodeToEmoji } from "../utils/convert-emoji-code";
// import Mongo from "~/services/mongo.server";

export const meta: MetaFunction = () => {
  return [{ title: "Buffer Threads Archive" }];
};

export async function loader({ request, context }: LoaderFunctionArgs) {
  // Check auth
  const auth = new Auth(context);
  const user = await auth.requireUser(request);

  // Fetch channels
  const mongoApi = new MongoDataAPI(context);
  const channels = await mongoApi.find<{
    _id: string;
    channelID: string;
    name: string;
    description: string;
    emojiCode: string;
  }>("channels", {
    sort: { name: 1 },
  });

  const cdnHost = context.cloudflare.env.CDN_HOST;

  return json({ user, channels, cdnHost });
}

export default function Index() {
  const { channels, cdnHost } = useLoaderData<typeof loader>();
  return (
    <>
      <h1>Welcome to the Buffer Threads Archive</h1>
      <ul>
        {channels.map((channel) => (
          <li key={channel._id}>
            <b>
              <Link to={`/channel/${channel.channelID}`}>
                {convertEmojiCodeToEmoji(channel.emojiCode, cdnHost, "react")} #
                {channel.name}
              </Link>
            </b>
            : {channel.description}
          </li>
        ))}
      </ul>
    </>
  );
}
