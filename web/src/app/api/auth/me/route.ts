import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/server/db";
import { User } from "@/lib/server/models/User";
import { Branch } from "@/lib/server/models/Branch";
import { getAuth } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await connectDb();
  const auth = getAuth(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const user = await User.findById(auth.sub).lean();
  if (!user || !user.isActive) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const branch = user.branchId ? await Branch.findById(user.branchId).lean() : null;
  return NextResponse.json({
    user: {
      id: user._id,
      name: user.name,
      role: user.role,
      branchId: user.branchId,
      branchName: branch?.branchName ?? null,
      phoneNumber: user.phoneNumber,
      email: user.email,
    },
  });
}
