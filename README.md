# Threads Archive Viewer

With Threads.com sunsetted on May 1, 2024 I've created a simple app to browse the archive of posts.

<img width="1840" alt="CleanShot 2024-04-22 at 16 45 09@2x" src="https://github.com/hamstu/threads-archive-viewer/assets/809093/05d5317f-fabd-46e9-b879-a752952a49fa">

## How this app is made

*Please note this app was built fairly quickly and is quite scrappy / rough around the edges. USE AT YOUR OWN RISK!*

This app is based on the Remix framework for React, and is designed to be deployed to Cloudflare. (I used their starter cloudflare template.) You could definitely deploy it elsewhere, but you'll have to adjust alot, like how env vars are handled in the app,  fix all the cloudflare specific remix imports, and so on.

This app is also built around using MongoDB Atlas, including their Atlas Search feature to provide nice text search capabilities. But you could swap this for a similar document based storage engine. There are no write operations, only read.

## Set Up Instructions

First, you'll need the data export from the Threads instance. This will be a large zip file that contains all the threads data (`thread.json` files) and attachments. It has a structure like this:

```
├── data-export
│   ├── channels.json
│   ├── users.json
│   ├── channels
│   │   ├── 34445734900                     # channel id
│   │   │   ├── 34445739006                 # thread id
│   │   │   │   ├── thread.json             # thread data (content, comments, etc)
│   │   │   │   ├── 34445739017_giphy.gif   # thread attachment(s), prefixed with attachment's uploadID (this is in the thread.json)
```

With this data you should:

1. Add threads and channels to a remote database
2. Upload the media to S3 (or some other remote storage/CDN)
3. Update this app's env vars
4. Test and run locally
5. Build and Deploy to your own Cloudflare account

We'll discuss these each in detail below.

### Adding threads and channels data to Database

I wrote a Node script to do this. It looks like this. (You can adjust paths for your setup.)

```ts
import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";

import { MongoClient, ServerApiVersion } from "mongodb";
const uri = process.env.MONGODB_URI as string;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    /**
     * Read and upload the data to MongoDB
     */
    const dataDir = path.join(__dirname, "data2");
    const channelsDir = path.join(dataDir, "channels");

    const allThreadsFiles = fs
      .readdirSync(channelsDir, { withFileTypes: true, recursive: true })
      .filter((fdsc) => fdsc.isFile() && fdsc.name === "thread.json");

    const threads = [];
    let count = 0;
    for (const file of allThreadsFiles) {
      count++;
      const threadPath = path.join(file.path, file.name);
      const threadData = JSON.parse(fs.readFileSync(threadPath, "utf-8"));
      // the channelId is the name of the 'parent parent' directory
      const channelID = path.basename(path.dirname(path.dirname(threadPath)));
      const createdAt = new Date(threadData.createdAt);
      const threadWithChannelId = { channelID, ...threadData, createdAt };

      console.log(
        count,
        threadWithChannelId.title,
        threadWithChannelId.channelID,
        threadWithChannelId.threadID,
      );

      threads.push(threadWithChannelId);
    }

    // put threads into batches
    const batchedThreads = [];
    const batchSize = 400;
    for (let i = 0; i < threads.length; i += batchSize) {
      batchedThreads.push(threads.slice(i, i + batchSize));
    }

    // now insert the threads into the database in batches
    for (const batch of batchedThreads) {
      const threadsCollection = client
        .db("threads-archive-v1")
        .collection("threads");

      const result = await threadsCollection.insertMany(batch);
      console.log(`${result.insertedCount} documents were inserted`);
    }
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}
run().catch(console.dir);
```

I've used `dotenv` here to get the MongoDB connection URI, so you'll need to put that in a `.env` file. There's a few other deps needed as well, so be sure to `npm init` and `npm install ..` those first. You can then run this script with `node` to upload the documents.

You also need to upload to a `channels` collection in your DB. This doesn't need any script, just upload them channels directly as they are in the JSON export. (Apps like "Mingo" make this easy since you can upload a JSON file into a collection.)

### Uploading media

This is also best done programmaticly, or with a CLI tool. I used [`rclone`](https://rclone.org/).

* First create a new bucket in your storage provider. I created one called `threads-archive` in S3.
* Now, follow the `rclone` instructions to setup a new endpoint, I called mine `buffer-s3`.
* Now you can upload the files by running this command from within the data export:

```bash
rclone copy ./channels buffer-s3:threads-archive/channels
```

This can take a LONG time, depending on your export size.

### Update env vars and local data

Open the `.dev.vars.example` file and rename it to `.dev.vars`. Fill in the variables as needed.

This app uses Google Auth to provide authentication. You'll need to create a Google app to get the app key and secret. Google our look this up in YouTube to see how to set that up. I kept the app locked to our org, so only active company Google accounts can log in. If you don't use Google Workspaces then you'll need to implement your own auth solution here.

The MongoDB Data API URI is not the same as regualr MongoDB connection string. It's needed because we can't use `mongodb` in serverless (like Cloudflare) so we need to make API requests instead. MongoDB Atlas provides a service for this that automatically exposes your DB via endpoints, and that's what I'm using here. If you end up using this, you can look it up in their docs: https://www.mongodb.com/docs/atlas/app-services/data-api/

There's also some local data that is hard coded, which you will need to update:

#### Custom Emojis

Since custom emojis were not part of the Threads export I had to cobble them together by scraping our Threads instance (which got me some, but not all) and getting the rest from our Slack instance. You can google to see how to programmatically exract custom emojis from Slack.

Once you have the custom emojis, you'll need to upload them to the `/custom-emojis/` path in whatever CDN you're using. Then update the object(s) in [replace-custom-emojis.ts](/app/utils/replace-custom-emojis.ts). I was able to extract a liust of the custom emojis we were using in our thread with a bash script like this: (requires you to have `jq` installed).

```bash
#!/bin/bash

# Directory to search in
search_dir="$1"

if [ -z "$search_dir" ]; then
  echo "Usage: $0 <directory>"
  exit 1
fi

# Find all 'thread.json' files, extract emojiCode values, sort, and count occurrences
find "$search_dir" -type f -name 'thread.json' -exec jq '.. | .emojiCode? | select(. != null)' {} + |
  sort |
  uniq -c |
  sort -nr
```

Save this as `emoji-scan.sh` near your data export and run it like this:

```bash
./emoji-scan.sh path-to-data
```

Where `path-to-data` is the path to the export files.

Now you have a list of emojis referenced in your threads, sorted by most used.

You may notice that many of these are in a format like `1F64C-1F3FB`. This is the unicode codepoint(s) for standard emojis, and will be rendered by the app automatically.

If you are missing custom emojis, the app will just render them as plain text.

#### Users

Since users are fixed and generally small in number, I also hardcoded them in the [users.ts](/app/services/users.ts) file. You can put what you get from the data export into that file. I was able to scrape avatars from Threads, so you can do that, or get them another way (i.e., from your Slack or some other tool.) Avatars aren't required for the app to run.

#### Channels

I wasn't perfectly consisistent and also use hardcoded channels sometimes (😅), so make sure to update [channels.ts](/app/services/channels.ts) with your channels data, the same as what you put in the `channels` collection in your database.

Ideally this would be removed to use one approach or the other, not both. So let that be an excercise for the reader, if they so choose.

### Testing Locally

You'll want to make sure it works locally. You can run it with:

```
npm install     # (if you haven't already)
npm run dev
```

### Build and Deploy

When everything is working locally, you can run these commands and follow the instructions for deploying to Cloudflare.

```bash
npm run build
npm run deploy
```

## Troubleshooting

* Make sure you have all the data the app needs (env vars, data in the CDN, custom emojis, etc.)
* Use at least Node v18
