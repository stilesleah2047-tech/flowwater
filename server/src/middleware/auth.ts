import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, AccessTokenPayload } from "@/utils/jwt";
import { UserRole } from "@/models/User";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AccessTokenPayload;
    }
  }
}

/**
 * Reads the access token from the httpOnly `access_token` cookie (web) or
 * an `Authorization: Bearer` header (native/mobile clients that can't rely
 * on cookie jars the same way). Attaches the decoded payload to req.auth.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const bearer = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : null;
  const token = req.cookies?.access_token ?? bearer;

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    req.auth = verifyAccessToken(token);
    next();
  } catch {
    return res.status(401).json({ error: "Session expired or invalid. Please log in again." });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (!roles.includes(req.auth.role)) {
      return res.status(403).json({ error: "Insufficient privileges for this action" });
    }
    next();
  };
}

/**
 * For routes that must resolve to a specific branch scope: SUPER_ADMIN may
 * pass a branchId query/body param to view/act on any branch; every other
 * role is hard-locked to their own token's branchId regardless of what
 * they send. Returns the effective branchId to use, or null if the caller
 * (a SUPER_ADMIN) wants the global/all-branch view.
 */
export function resolveBranchScope(req: Request, requestedBranchId?: string | null): string | null {
  if (!req.auth) throw new Error("resolveBranchScope called without req.auth");
  if (req.auth.role === "SUPER_ADMIN") {
    return requestedBranchId && requestedBranchId !== "ALL" ? requestedBranchId : null;
  }
  return req.auth.branchId;
}
