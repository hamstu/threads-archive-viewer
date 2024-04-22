import {
  LoaderFunctionArgs,
  json,
  type MetaFunction,
} from "@remix-run/cloudflare";
import { Link, useLoaderData } from "@remix-run/react";
import * as Tooltip from "@radix-ui/react-tooltip";

import { Auth } from "~/services/auth.server";
import MongoDataAPI from "~/services/mongo-data-api.server";

import Markdown, { Components } from "react-markdown";
import { Block, Thread } from "~/types/types";
import { replaceUserMentionsWithLinks } from "~/utils/replace-user-mentions";
import replaceCustomEmojis from "~/utils/replace-custom-emojis";
import { getUserById } from "~/services/users";
import { getChannelByID } from "~/services/channels";
import { convertEmojiCodeToEmoji } from "~/utils/convert-emoji-code";
import { getBlockAttachmentURL } from "~/services/static-assets";

function fixMarkdownListItems(markdown: string) {
  return markdown
    .split("\n")
    .map((line) => {
      if (line.startsWith("** ")) {
        return line.replace("** ", "  * ");
      }
      if (line.endsWith(" *")) {
        return line.slice(0, -2) + "*";
      }
      if (line.endsWith(" * ")) {
        return line.slice(0, -3) + "*";
      }
      return line;
    })
    .join("\n");
}

function removeInvisibleChars(str: string) {
  return str.replace(/[\u200B-\u200D\uFEFF]/g, "");
}

function addCodeBlocks(block: Block, md: string) {
  let newMd = md;
  if (block.markdown.contentSupplements.codeSnippets.length > 0) {
    block.markdown.contentSupplements.codeSnippets.forEach(
      (codeSnippet, index) => {
        newMd = md.replace(
          "<snippet|" + index + ">",
          "```\n" + codeSnippet.lines.join("\n") + "\n```"
        );
      }
    );
  }
  return newMd;
}

function addAttachments(
  thread: Thread,
  block: Block,
  md: string,
  cdnHost: string
) {
  let newMd = md;
  let match;
  let index = 0;
  const attachmentRegex = /<!(\d+)\|([^>]*)?>/g;
  while ((match = attachmentRegex.exec(md))) {
    // const attachmentIndex = parseInt(match[1]);
    const attachment = block.attachments?.[index];
    if (attachment) {
      const url = getBlockAttachmentURL(thread, attachment, cdnHost);
      if (attachment.mimeType.startsWith("image/")) {
        newMd = newMd.replace(
          match[0],
          `![${attachment.downloadFilename}](${url})`
        );
      } else {
        newMd = newMd.replace(
          match[0],
          `[${attachment.downloadFilename}](${url})`
        );
      }
    } else {
      newMd = newMd.replace(match[0], JSON.stringify(attachment));
    }
    index++;
  }
  return newMd;
}

function fixBrokenNewlineLinks(md: string) {
  return md.replace("\n]", "]");
}

const mdComponents: Components = {
  // in Threads, they used `*` for bold text, which is not standard markdown
  // So we'll replace it with `<strong>` instead
  em: ({ children }) => <strong>{children}</strong>,
  a: ({ children, href }) => {
    // replace any hrefs to threads.com or async.threads.com with this current domain
    const newHref = href?.replace(/https?:\/\/(async\.)?threads\.com/g, "");
    return (
      <a href={newHref} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  },
  img: ({ src, alt }) => {
    const isEmoji = src?.includes("custom-emoji");
    return (
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
      <img
        style={!isEmoji ? { cursor: "pointer" } : {}}
        src={src}
        alt={alt}
        onClick={() => {
          window.open(src, "_blank");
        }}
      />
    );
  },
};

function processBlocks(thread: Thread, blocks: Block[], cdnHost: string) {
  return blocks.map((block) => {
    let md = block.markdown.content;
    md = md.replace(/\n/g, "\n\n");
    md = replaceUserMentionsWithLinks(md);
    md = replaceCustomEmojis(md, cdnHost);
    md = fixMarkdownListItems(md);
    md = removeInvisibleChars(md);
    md = addCodeBlocks(block, md);
    md = fixBrokenNewlineLinks(md);
    md = addAttachments(thread, block, md, cdnHost);

    return md;
  });
}

function BlockReactions({ block, cdnHost }: { block: Block; cdnHost: string }) {
  if (!block.reactions || block.reactions.length === 0) {
    return null;
  }

  // group reactions by emojiCode
  const reactionCounts: Record<string, Block["reactions"]> = {};
  block.reactions.forEach((reaction) => {
    if (reactionCounts[reaction.emojiCode]) {
      reactionCounts[reaction.emojiCode]?.push(reaction);
    } else {
      reactionCounts[reaction.emojiCode] = [reaction];
    }
  });

  return (
    <div className="reactions">
      {Object.entries(reactionCounts).map(([emojiCode, reactions]) => {
        const emoji = convertEmojiCodeToEmoji(emojiCode, cdnHost, "react");
        const emojiLarge = convertEmojiCodeToEmoji(
          emojiCode,
          cdnHost,
          "react",
          "emoji-large"
        );
        return (
          <Tooltip.Root key={emojiCode}>
            <Tooltip.Trigger asChild>
              <div className="reaction">
                <span>{emoji}</span>
                <span className="num">{reactions?.length}</span>
              </div>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                className="TooltipContent"
                sideOffset={5}
                side="bottom"
              >
                <div className="emoji-large-wrapper">{emojiLarge}</div>
                {reactions
                  ?.map(
                    (reaction) =>
                      getUserById(reaction.userID, cdnHost)?.firstName
                  )
                  .join(", ")}
                <Tooltip.Arrow className="TooltipArrow" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        );
      })}
    </div>
  );
}

export async function loader({ request, context, params }: LoaderFunctionArgs) {
  // Check auth
  const auth = new Auth(context);
  const user = await auth.requireUser(request);

  // Fetch thread
  const mongo = new MongoDataAPI(context);
  const thread = await mongo.findOne<Thread>("threads", {
    filter: { threadID: params.threadID },
  });

  const cdnHost = context.cloudflare.env.CDN_HOST;

  /** @todo this should be handled by the mongo lib */
  if (!thread) {
    return json({ user, thread: null, cdnHost });
  }

  return json({ user, thread, cdnHost });
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  return [{ title: `${data?.thread?.title} - Threads Archive` }];
};

export default function ThreadView() {
  const { thread, cdnHost } = useLoaderData<typeof loader>();

  if (!thread) {
    return <h1>Thread not found</h1>;
  }

  const mdBlocks = processBlocks(thread, thread.blocks, cdnHost);

  // Let's find replies for the main blocks of the thread so we can display
  // them later below the main thread content
  const mainBlockIDs = thread.blocks.map((block) => block.contentID);
  const mainReplies = thread.comments
    .filter((comment) => {
      return (
        comment.contentType === "reply" &&
        comment.blocks.some(
          (commentBlock) =>
            commentBlock.parentID &&
            mainBlockIDs.includes(commentBlock.parentID)
        )
      );
    })
    .map((comment) => {
      // Tag them with some extra info so we can render them later
      comment.isMainReply = true;
      comment.mainReplyContentID = thread.blocks.find(
        (block) => block.contentID === comment.blocks[0].parentID
      )?.contentID;
      return comment;
    })
    .sort((a, b) => {
      return (
        mainBlockIDs.indexOf(b.blocks[0].parentID || "") -
        mainBlockIDs.indexOf(a.blocks[0].parentID || "")
      );
    });

  // Commments to render are the mainReplies first, then all non-reply comments
  const topLevelComments = mainReplies.concat(
    thread.comments.filter((comment) => comment.contentType !== "reply")
  );

  const user = getUserById(thread.authorID, cdnHost);

  const formattedDate = Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(thread.createdAt));

  const channel = getChannelByID(thread.channelID);
  const channelLink = channel ? `/channel/${channel.channelID}` : "/";
  const channelLinkComponent = channel ? (
    <Link to={channelLink}>
      {convertEmojiCodeToEmoji(channel.emojiCode, cdnHost, "react")} #
      {channel.name}
    </Link>
  ) : (
    <span>{channelLink}</span>
  );

  const mainRepliesRendered: string[] = [];

  return (
    <>
      <div className="thread-meta">
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={thread.authorName}
            className="thread-meta-avatar"
          />
        ) : (
          <img
            src={`https://ui-avatars.com/api/?background=6b4afc&color=fff&name=${thread.authorName}&size=128&bold=true`}
            alt={thread.authorName}
            className="thread-meta-avatar"
          />
        )}
        <div className="thread-meta-info">
          <a className="thread-meta-authorName" href={"/user/" + thread.authorID}>{thread.authorName}</a>
          <div className="thread-meta-dateAndLink">
            <span className="thread-date">{formattedDate}</span> •{" "}
            <span>{channelLinkComponent}</span>
          </div>
        </div>
      </div>
      <main className="main-thread">
        {mdBlocks.map((block, index) => (
          <div
            key={index}
            className="block"
            id={thread.blocks[index].contentID}
          >
            <Markdown components={mdComponents}>{block}</Markdown>
            <BlockReactions block={thread.blocks[index]} cdnHost={cdnHost} />
          </div>
        ))}
      </main>
      <section className="comments">
        {topLevelComments.map((comment) => {
          const commentBlocksMd = processBlocks(
            thread,
            comment.blocks,
            cdnHost
          );
          const commentAuthor = getUserById(comment.authorID, cdnHost);
          const commentDate = Intl.DateTimeFormat("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(comment.createdAt));

          // Prepare for rendering main reply header
          let extraClass = "";
          let shouldRenderMainReplyHeader = false;
          let mainReplyText = "";
          if (comment.mainReplyContentID) {
            shouldRenderMainReplyHeader = !mainRepliesRendered.includes(
              comment.mainReplyContentID
            );
            if (shouldRenderMainReplyHeader) {
              // Add it so we don't render it again for this block
              extraClass = "has-main-reply";
              mainReplyText =
                thread.blocks.find(
                  (block) => block.contentID === comment.mainReplyContentID
                )?.plaintext || "Reply to main thread";
              mainRepliesRendered.push(comment.mainReplyContentID);
            } else {
              extraClass = "has-main-reply-sub";
            }
          }
          return (
            <div className={`comment ${extraClass}`} key={comment.contentID}>
              {shouldRenderMainReplyHeader && (
                <div className="comment-main-reply">
                  <Link
                    to={`#${comment.mainReplyContentID}`}
                    title={mainReplyText}
                  >
                    {mainReplyText}
                  </Link>
                </div>
              )}
              <div className="comment-author">
                {commentAuthor?.avatarUrl ? (
                  <img
                    src={commentAuthor.avatarUrl}
                    alt={comment.authorName}
                    className="comment-avatar"
                  />
                ) : (
                  <img
                    src={`https://ui-avatars.com/api/?background=6b4afc&color=fff&name=${comment.authorName}&size=128&bold=true`}
                    alt={comment.authorName}
                    className="comment-avatar"
                  />
                )}
              </div>
              <div className="comment-content">
                <div className="comment-author-name">
                  {comment.authorName} •{" "}
                  <span className="comment-date">{commentDate}</span>
                </div>
                {commentBlocksMd.map((block, index) => (
                  <div
                    key={comment.blocks[index].contentID}
                    className="comment-block"
                    id={comment.blocks[index].contentID}
                  >
                    <Markdown components={mdComponents}>{block}</Markdown>
                    <BlockReactions
                      block={comment.blocks[index]}
                      cdnHost={cdnHost}
                    />
                    {/* Block Replies – code here could be DRYer, but 🤷‍♂️ */}
                    {thread.comments
                      .filter((c) => c.contentType === "reply")
                      .filter((reply) => {
                        return reply.blocks.some(
                          (replyBlock) =>
                            replyBlock.parentID ===
                            comment.blocks[index].contentID
                        );
                      })
                      .map((reply) => {
                        const replyBlocksMd = processBlocks(
                          thread,
                          reply.blocks,
                          cdnHost
                        );
                        const replyAuthor = getUserById(
                          reply.authorID,
                          cdnHost
                        );
                        const replyDate = Intl.DateTimeFormat("en-US", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(reply.createdAt));
                        return (
                          <div key={reply.contentID} className="comment reply">
                            <div className="comment-author">
                              {replyAuthor?.avatarUrl ? (
                                <img
                                  src={replyAuthor.avatarUrl}
                                  alt={reply.authorName}
                                  className="comment-avatar"
                                />
                              ) : (
                                <img
                                  src={`https://ui-avatars.com/api/?background=6b4afc&color=fff&name=${reply.authorName}&size=128&bold=true`}
                                  alt={reply.authorName}
                                  className="comment-avatar"
                                />
                              )}
                            </div>
                            <div className="comment-content">
                              <div className="comment-author-name">
                                {reply.authorName} •{" "}
                                <span className="comment-date">
                                  {replyDate}
                                </span>
                              </div>
                              {replyBlocksMd.map((block, index) => (
                                <div
                                  key={reply.blocks[index].contentID}
                                  className="comment-block"
                                  id={reply.blocks[index].contentID}
                                >
                                  <Markdown components={mdComponents}>
                                    {block}
                                  </Markdown>
                                  <BlockReactions
                                    block={reply.blocks[index]}
                                    cdnHost={cdnHost}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </>
  );
}
