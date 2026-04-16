import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  // Post-authentication checks: soft-deleted or session invalidated
  if (user) {
    // If user is soft-deleted, treat as unauthenticated
    if (user.deletedAt) {
      user = null;
    }
    // If password was changed after last sign-in, invalidate session
    else if (user.sessionInvalidatedAt && user.lastSignedIn) {
      const invalidatedAt = new Date(user.sessionInvalidatedAt).getTime();
      const lastSignedIn = new Date(user.lastSignedIn).getTime();
      if (lastSignedIn < invalidatedAt) {
        user = null;
      }
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
