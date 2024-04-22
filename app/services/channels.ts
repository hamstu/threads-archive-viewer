import { Channel } from "~/types/types";

const channels: Channel[] = [
  // paste your channels.json here
]

export function getChannelByID(channelID: string): Channel | undefined {
  return channels.find((channel) => channel.channelID === channelID);
}
