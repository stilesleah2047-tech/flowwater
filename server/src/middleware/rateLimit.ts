import rateLimit from "express-rate-limit";

/**
 * Login endpoints are the highest-value brute-force target in this app —
 * a 4-digit PIN has only 10,000 possibilities, so without rate limiting a
 * script could exhaust the keyspace against a single phone number in
 * minutes. Paired with account-level lockout in auth.routes.ts, which
 * locks an account after repeated failures regardless of source IP (this
 * IP-keyed limiter alone can be dodged by rotating IPs against a fixed
 * target account).
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please wait and try again." },
});

export const stkPushRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.auth?.sub ?? req.ip ?? "unknown",
  message: { error: "Too many payment prompts sent recently. Wait a moment and try again." },
});

export const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
