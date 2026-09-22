import { Router } from "express";
import { z } from "zod";
import { Branch } from "@/models/Branch";
import { requireAuth, requireRole } from "@/middleware/auth";

export const branchesRouter = Router();

branchesRouter.get("/", requireAuth, async (req, res) => {
  if (req.auth!.role === "SUPER_ADMIN") {
    const branches = await Branch.find().sort({ branchName: 1 }).lean();
    return res.json({ branches });
  }
  if (!req.auth!.branchId) {
    return res.json({ branches: [] });
  }
  const branch = await Branch.findById(req.auth!.branchId).lean();
  res.json({ branches: branch ? [branch] : [] });
});

const createSchema = z.object({
  branchName: z.string().trim().min(1).max(120),
  locationCity: z.string().trim().min(1).max(120),
});

/** POST /api/branches — SUPER_ADMIN only. This is the root of the org chart:
 * a branch must exist before any manager or delivery staff can be assigned to it. */
branchesRouter.post("/", requireAuth, requireRole("SUPER_ADMIN"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }
  const branch = await Branch.create(parsed.data);
  res.status(201).json({ branch });
});

