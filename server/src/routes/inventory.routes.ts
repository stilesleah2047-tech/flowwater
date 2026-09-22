import { Router } from "express";
import { z } from "zod";
import { DailyInventory } from "@/models/DailyInventory";
import { requireAuth, requireRole, resolveBranchScope } from "@/middleware/auth";

export const inventoryRouter = Router();

function todayLocal(): string {
  return new Date().toISOString().slice(0, 10);
}

const dispatchSchema = z.object({
  productId: z.string().min(1),
  morningDispatched: z.number().int().min(0),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/**
 * POST /api/inventory/dispatch — branch manager records how many units of
 * a given size went out this morning. Upserts so re-entering the same
 * branch+product+day corrects rather than duplicates.
 */
inventoryRouter.post(
  "/dispatch",
  requireAuth,
  requireRole("BRANCH_MANAGER", "SUPER_ADMIN"),
  async (req, res) => {
    const parsed = dispatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    }
    const branchId = resolveBranchScope(req, req.body.branchId);
    if (!branchId) {
      return res.status(400).json({ error: "branchId is required" });
    }
    const date = parsed.data.date ?? todayLocal();

    const row = await DailyInventory.findOneAndUpdate(
      { branchId, productId: parsed.data.productId, date },
      { morningDispatched: parsed.data.morningDispatched, recordedBy: req.auth!.sub },
      { upsert: true, new: true }
    );
    res.json({ inventory: row });
  }
);

const countSchema = z.object({
  productId: z.string().min(1),
  eveningPhysicalCount: z.number().int().min(0),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/** POST /api/inventory/evening-count — branch manager records the physical count at close. */
inventoryRouter.post(
  "/evening-count",
  requireAuth,
  requireRole("BRANCH_MANAGER", "SUPER_ADMIN"),
  async (req, res) => {
    const parsed = countSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    }
    const branchId = resolveBranchScope(req, req.body.branchId);
    if (!branchId) {
      return res.status(400).json({ error: "branchId is required" });
    }
    const date = parsed.data.date ?? todayLocal();

    const row = await DailyInventory.findOneAndUpdate(
      { branchId, productId: parsed.data.productId, date },
      { eveningPhysicalCount: parsed.data.eveningPhysicalCount, recordedBy: req.auth!.sub },
      { upsert: true, new: true }
    );
    res.json({ inventory: row });
  }
);
