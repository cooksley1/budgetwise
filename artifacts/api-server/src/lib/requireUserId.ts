import { getAuth } from "@clerk/express";
import type { Request, Response } from "express";

/**
 * Extracts the userId from the request.
 *
 * Priority:
 *  1. Clerk session (cookie or Authorization: Bearer <clerk-session-token>)
 *  2. Guest mode — Authorization: Bearer guest-<uuid> (stored in the browser's
 *     localStorage and injected by the api-client-react customFetch). Guest IDs
 *     are valid UUIDs prefixed with "guest-" so they are trivially distinguishable
 *     from real Clerk user IDs.
 *
 * Returns null and sends a 401 if neither is present.
 */
const GUEST_TOKEN_RE =
  /^guest-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function requireUserId(req: Request, res: Response): string | null {
  const { userId } = getAuth(req);
  if (userId) return userId;

  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    if (GUEST_TOKEN_RE.test(token)) return token;
  }

  res.status(401).json({ error: "Unauthorized" });
  return null;
}
