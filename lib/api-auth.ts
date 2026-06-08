import "server-only";

import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export async function getAuthenticatedUserId(): Promise<string | null> {
  const token = await convexAuthNextjsToken();
  if (!token) {
    return null;
  }

  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  client.setAuth(token);

  return await client.query(api.users.getCurrentUserId, {});
}
