import { AppLoadContext } from "@remix-run/cloudflare";

/**
 * Since we can't use the `mongodb` package in Cloudflare Workers, we use the
 * MongoDB Data API to interact with our MongoDB Atlas cluster.
 * https://www.mongodb.com/docs/atlas/app-services/data-api/openapi/
 */
export default class MongoDataAPI {
  protected apiKey: string | undefined;
  protected baseURL: string | undefined;
  protected dataSource = "threads-archive-v1";
  protected database = "threads-archive-v1";

  private actions = {
    findOne: "/action/findOne",
    find: "/action/find",
    aggregate: "/action/aggregate",
  };

  constructor(context: AppLoadContext) {
    this.apiKey = context.cloudflare.env.MONGODB_DATA_API_KEY;
    this.baseURL = context.cloudflare.env.MONGODB_DATA_API_URL;
  }

  async getHeaders() {
    return {
      "Content-Type": "application/json",
      "Access-Control-Request-Headers": "*",
      "api-key": this.apiKey as string,
    };
  }

  async exec<T>(
    action: string,
    collection: string,
    params: object
  ): Promise<T> {
    const url = `${this.baseURL}${action}`;
    const headers = await this.getHeaders();
    const data = JSON.stringify({
      dataSource: this.dataSource,
      database: this.database,
      collection,
      ...params,
    });
    return fetch(url, { method: "POST", headers, body: data }).then((res) =>
      res.json()
    );
  }

  /** @todo update types so this can return no result */
  async findOne<T>(collection: string, params: object): Promise<T> {
    const result = await this.exec<{ document: T }>(
      this.actions.findOne,
      collection,
      params
    );
    return result.document;
  }
  async find<T>(collection: string, params: object): Promise<Array<T>> {
    const result = await this.exec<{ documents: T[] }>(
      this.actions.find,
      collection,
      params
    );
    return result.documents;
  }
  async count(collection: string, match: object): Promise<number> {
    const result = await this.exec<{ documents: { count: number }[] }>(
      this.actions.aggregate,
      collection,
      {
        pipeline: [{ $match: match }, { $count: "count" }],
      }
    );
    return result.documents[0].count;
  }
  async search<T>(
    collection: string,
    query: string,
    sort: "relevance" | "newest" | "oldest"
  ): Promise<Array<T>> {
    let sortParam: Record<string, number | object> = {
      unused: { $meta: "searchScore" },
    }; // default to relevance
    if (sort === "newest") {
      sortParam = { createdAt: -1 };
    } else if (sort === "oldest") {
      sortParam = { createdAt: 1 };
    }
    const result = await this.exec<{
      documents: { docs: T[]; meta: object }[];
    }>(this.actions.aggregate, collection, {
      pipeline: [
        {
          $search: {
            index: "default",
            returnStoredSource: true,
            sort: sortParam,
            text: {
              query,
              path: {
                wildcard: "*",
              },
            },
          },
        },
        {
          $project: {
            title: 1,
            threadID: 1,
            authorName: 1,
            authorID: 1,
            channelID: 1,
            createdAt: 1,
            meta: "$$SEARCH_META",
          },
        },
        { $limit: 100 },
        {
          $facet: {
            docs: [],
            meta: [{ $replaceWith: "$$SEARCH_META" }, { $limit: 1 }],
          },
        },
      ],
    });
    console.log(result);
    return result.documents[0].docs;
  }
}
