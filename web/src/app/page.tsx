"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { AuthUser } from "@/lib/types";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const result = await apiFetch<{ user: AuthUser }>("/api/auth/me");
        if (result.user.role === "DELIVERY") {
          router.replace("/terminal");
        } else {
          router.replace("/admin/dashboard");
        }
      } catch {
        router.replace("/login");
      }
    })();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-depth-900">
      <p className="text-sand-200/60">Loading…</p>
    </main>
  );
}
