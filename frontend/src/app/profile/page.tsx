"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

// Redirect /profile → /profile/{current_username}
export default function ProfileRedirect() {
  const router = useRouter();

  useEffect(() => {
    apiFetch<{ username: string }>("/api/auth/me")
      .then((me) => router.replace(`/profile/${me.username}`))
      .catch(() => router.replace("/login"));
  }, [router]);

  return <p style={{ padding: "2rem", color: "#888" }}>Loading…</p>;
}
