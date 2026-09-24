import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDb } from "@/lib/server/db";
import { User } from "@/lib/server/models/User";
import { Branch } from "@/lib/server/models/Branch";
import { getAuth, requireRole, resolveBranchScope } from "@/lib/server/auth";
import { normalizeKenyanPhone } from "@/lib/server/phone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await connectDb();
  const auth = getAuth(req);
  if (!requireRole(auth, "BRANCH_MANAGER", "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const branchId = resolveBranchScope(auth!, req.nextUrl.searchParams.get("branchId"));
  const filter: Record<string, unknown> = branchId ? { branchId } : {};
  const users = await User.find(filter).select("-passwordHash").sort({ name: 1 }).lean();
  return NextResponse.json({ users });
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  role: z.enum(["DELIVERY", "BRANCH_MANAGER", "SUPER_ADMIN"]),
  branchId: z.string().min(1).optional(),
  phoneNumber: z.string().min(9).max(15),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: NextRequest) {
  await connectDb();
  const auth = getAuth(req);
  if (!requireRole(auth, "BRANCH_MANAGER", "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  const data = parsed.data;

  if (auth!.role === "BRANCH_MANAGER") {
    if (data.role !== "DELIVERY") {
      return NextResponse.json({ error: "Branch managers may only create delivery staff accounts" }, { status: 403 });
    }
    if (data.branchId && data.branchId !== auth!.branchId) {
      return NextResponse.json({ error: "Branch managers may only add staff to their own branch" }, { status: 403 });
    }
  }

  const branchId = data.role === "SUPER_ADMIN" ? null : data.branchId ?? auth!.branchId ?? undefined;
  if (data.role !== "SUPER_ADMIN" && !branchId) {
    return NextResponse.json({ error: "branchId is required for this role" }, { status: 400 });
  }

  let phone: string;
  try {
    phone = normalizeKenyanPhone(data.phoneNumber);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
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
    return NextResponse.json({ user: obj }, { status: 201 });
  } catch (err: any) {
    if (err?.code === 11000) {
      return NextResponse.json({ error: "A user with this phone number or email already exists" }, { status: 409 });
    }
    throw err;
  }
}
