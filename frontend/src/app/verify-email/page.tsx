"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setMessage("No verification token found in the URL.");
      setStatus("error");
      return;
    }

    apiFetch<{ message: string }>(
      `/api/auth/verify-email?token=${encodeURIComponent(token)}`
    )
      .then((data) => {
        setMessage(data.message);
        setStatus("success");
      })
      .catch((err: Error) => {
        setMessage(err.message);
        setStatus("error");
      });
  }, [token]);

  return (
    <main style={{ padding: "2rem", maxWidth: 480 }}>
      <h1>Email Verification</h1>

      {status === "loading" && <p style={{ color: "#888" }}>Verifying…</p>}

      {status === "success" && (
        <>
          <p style={{ color: "green" }}>✓ {message}</p>
          <p>
            <Link href="/login">Go to login →</Link>
          </p>
        </>
      )}

      {status === "error" && (
        <>
          <p style={{ color: "crimson" }}>✗ {message}</p>
          <p>
            <Link href="/register">Register again</Link>
          </p>
        </>
      )}
    </main>
  );
}

// useSearchParams() requires a Suspense boundary in Next.js App Router
export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <main style={{ padding: "2rem" }}>
          <p>Loading…</p>
        </main>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
