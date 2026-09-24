import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDb } from "@/lib/server/db";
import { Product } from "@/lib/server/models/Product";
import { getAuth, requireRole } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await connectDb();
  const auth = getAuth(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const products = await Product.find({ isActive: true }).sort({ sortOrder: 1 }).lean();
  return NextResponse.json({ products });
}

const createSchema = z.object({
  label: z.string().trim().min(1).max(60),
  sizeLiters: z.number().positive().max(1000),
  unitPrice: z.number().nonnegative(),
  sortOrder: z.number().int().optional(),
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
  const product = await Product.create(parsed.data);
  return NextResponse.json({ product }, { status: 201 });
}
