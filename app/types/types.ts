export type Channel = {
  _id?: string;
  channelID: string;
  name: string;
  description: string;
  creatorID: string;
  memberIDs: string[];
  privacy: 'public' | 'private';
  createdTimestamp: string; // Date in ISO string format
  emojiCode: string | null;
};

type ThreadID = string;
type UserID = string;
type ContentID = string;
type FileID = string;
export type ContentType = 'thread' | 'comment' | 'reply';

interface CodeSnippet {
  lines: string[];
}

interface Markdown {
  content: string;
  contentSupplements: {
    // tables: any[]; // Assuming we don't have the exact structure of tables and codeSnippets
    codeSnippets: CodeSnippet[];
  };
}

export interface Block {
  contentID: ContentID;
  plaintext: string;
  markdown: Markdown;
  reactions?: Reaction[];
  attachments?: Attachment[];
  parentID?: ContentID; // Optional as it might not exist for top-level blocks
}

interface Reaction {
  userID: UserID;
  emojiCode: string;
  createdAt: string; // Date in ISO string format
}

export interface Attachment {
  fileID: FileID;
  mimeType: string;
  bytes: number;
  downloadFilename: string;
}

interface Comment extends Omit<Block, 'reactions' | 'attachments'> {
  contentType: 'comment' | 'reply';
  authorID: UserID;
  authorName: string;
  blocks: Block[]; // Comments can have blocks similar to threads
  createdAt: string; // Date in ISO string format
  isMainReply?: boolean; // Optional
  mainReplyContentID?: ContentID; // Optional
}

export interface Thread {
  threadID: ThreadID;
  channelID: string;
  contentType: 'thread';
  authorID: UserID;
  authorName: string;
  blocks: Block[];
  createdAt: string; // Date in ISO string format
  title: string;
  comments: Comment[];
  audienceIDs: UserID[]; // Assuming AudienceIDs are user IDs
}
