"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Dashboard is retired — the nav bar and profile page replace it.
export default function DashboardRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/feed"); }, [router]);
  return null;
}
