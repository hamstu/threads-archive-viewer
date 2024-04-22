// app/services/auth.server.ts
import {
  AppLoadContext,
  SessionStorage,
  createCookieSessionStorage,
  redirect,
} from "@remix-run/cloudflare";
import { Authenticator } from "remix-auth";
import { GoogleStrategy } from "remix-auth-google";

export type User = {
  id: string;
  email: string;
  role: string;
};

export class Auth {
  protected authenticator: Authenticator<User>;
  protected sessionStorage: SessionStorage;

  public authenticate: Authenticator<User>["authenticate"];

  constructor(context: AppLoadContext) {
    this.sessionStorage = createCookieSessionStorage({
      cookie: {
        name: "auth",
        path: "/",
        maxAge: 60 * 60 * 24 * 365, // 1 year
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        secrets: [context.cloudflare.env.COOKIE_SESSION_SECRET],
      },
    });

    this.authenticator = new Authenticator<User>(this.sessionStorage, {
      throwOnError: true,
      sessionKey: "user",
    });

    const googleStrategy = new GoogleStrategy(
      {
        clientID: context.cloudflare.env.GOOGLE_CLIENT_ID,
        clientSecret: context.cloudflare.env.GOOGLE_CLIENT_SECRET,
        callbackURL: context.cloudflare.env.GOOGLE_CALLBACK_URL,
      },
      async ({ profile }) => {
        // Get the user data from your DB or API using the tokens and profile
        // return User.findOrCreate({ email: profile.emails[0].value })
        return {
          id: "1",
          email: profile.emails[0].value,
          role: "user",
        };
      }
    );

    this.authenticator.use(googleStrategy);

    this.authenticate = this.authenticator.authenticate.bind(
      this.authenticator
    );
  }

  public async getSession(request: Request) {
    const session = await this.sessionStorage.getSession(
      request.headers.get("cookie")
    );
    return session.data;
  }

  public async clear(request: Request) {
    const session = await this.sessionStorage.getSession(
      request.headers.get("cookie")
    );
    return this.sessionStorage.destroySession(session);
  }

  public async readUser(request: Request) {
    const session = await this.sessionStorage.getSession(
      request.headers.get("cookie")
    );
    return session.get("user");
  }

  public async requireUser(request: Request, returnTo = "/auth/login") {
    const maybeUser = await this.readUser(request);
    if (!maybeUser) throw redirect(returnTo);
    return maybeUser;
  }
}
