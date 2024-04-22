import { Attachment, Thread } from "~/types/types";

export function getBlockAttachmentURL(
  thread: Thread,
  attachment: Attachment,
  cdnHost: string
) {
  const channelID = thread.channelID;
  const threadID = thread.threadID;
  const attachmentFilename = encodeURIComponent(
    `${attachment.fileID}_${attachment.downloadFilename}`
  );
  return `${cdnHost}/channels/${channelID}/${threadID}/${attachmentFilename}`;
}
