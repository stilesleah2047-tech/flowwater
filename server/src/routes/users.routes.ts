import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { User } from "@/models/User";
import { Branch } from "@/models/Branch";
import { requireAuth, requireRole, resolveBranchScope } from "@/middleware/auth";
import { normalizeKenyanPhone } from "@/utils/phone";

export const usersRouter = Router();

usersRouter.get("/", requireAuth, requireRole("BRANCH_MANAGER", "SUPER_ADMIN"), async (req, res) => {
  const branchId = resolveBranchScope(req, req.query.branchId as string | undefined);
  const filter: Record<string, unknown> = branchId ? { branchId } : {};
  const users = await User.find(filter).select("-passwordHash").sort({ name: 1 }).lean();
  res.json({ users });
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  role: z.enum(["DELIVERY", "BRANCH_MANAGER", "SUPER_ADMIN"]),
  branchId: z.string().min(1).optional(),
  phoneNumber: z.string().min(9).max(15),
  email: z.string().email(),
  password: z.string().min(8),
});

usersRouter.post("/", requireAuth, requireRole("BRANCH_MANAGER", "SUPER_ADMIN"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }
  const data = parsed.data;

  if (req.auth!.role === "BRANCH_MANAGER") {
    if (data.role !== "DELIVERY") {
      return res.status(403).json({ error: "Branch managers may only create delivery staff accounts" });
    }
    if (data.branchId && data.branchId !== req.auth!.branchId) {
      return res.status(403).json({ error: "Branch managers may only add staff to their own branch" });
    }
  }

  const branchId = data.role === "SUPER_ADMIN" ? null : data.branchId ?? req.auth!.branchId ?? undefined;
  if (data.role !== "SUPER_ADMIN" && !branchId) {
    return res.status(400).json({ error: "branchId is required for this role" });
  }

  let phone: string;
  try {
    phone = normalizeKenyanPhone(data.phoneNumber);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }

  const passwordHash = await bcrypt.hash(data.password, 12);

  try {
    const user = await User.create({
      name: data.name,
      role: data.role,
      branchId: branchId ?? null,
      phoneNumber: phone,
      email: data.email.toLowerCase(),
      passwordHash,
    });

    if (data.role === "BRANCH_MANAGER" && branchId) {
      await Branch.findByIdAndUpdate(branchId, { managerId: user._id });
    }

    const obj: any = user.toObject();
    delete obj.passwordHash;
    res.status(201).json({ user: obj });
  } catch (err: any) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "A user with this phone number or email already exists" });
    }
    throw err;
  }
});
