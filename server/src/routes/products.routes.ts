import { Router } from "express";
import { z } from "zod";
import { Product } from "@/models/Product";
import { requireAuth, requireRole } from "@/middleware/auth";

export const productsRouter = Router();

productsRouter.get("/", requireAuth, async (_req, res) => {
  const products = await Product.find({ isActive: true }).sort({ sortOrder: 1 }).lean();
  res.json({ products });
});

const createSchema = z.object({
  label: z.string().trim().min(1).max(60),
  sizeLiters: z.number().positive().max(1000),
  unitPrice: z.number().nonnegative(),
  sortOrder: z.number().int().optional(),
});

productsRouter.post("/", requireAuth, requireRole("BRANCH_MANAGER", "SUPER_ADMIN"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }
  const product = await Product.create(parsed.data);
  res.status(201).json({ product });
});

const updateSchema = z.object({
  label: z.string().trim().min(1).max(60).optional(),
  sizeLiters: z.number().positive().max(1000).optional(),
  unitPrice: z.number().nonnegative().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

productsRouter.patch("/:id", requireAuth, requireRole("BRANCH_MANAGER", "SUPER_ADMIN"), async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }
  if (Object.keys(parsed.data).length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }
  const product = await Product.findByIdAndUpdate(req.params.id, parsed.data, { new: true });
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json({ product });
});
