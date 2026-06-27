"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

interface HealthResponse {
  status: string;
  database: string;
}

export default function Home() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<HealthResponse>("/api/health")
      .then(setHealth)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main style={{ padding: "2rem", maxWidth: 480 }}>
      <h1 style={{ marginBottom: 4 }}>IUSConnect</h1>
      <p style={{ color: "#666", marginTop: 0 }}>
        Campus social network · IUS Sarajevo
      </p>
      <hr style={{ margin: "1.5rem 0" }} />
      <h2 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>
        Backend health check
      </h2>
      {loading && <p style={{ color: "#888" }}>Contacting backend…</p>}
      {error && (
        <p style={{ color: "crimson" }}>
          Could not reach backend: <code>{error}</code>
        </p>
      )}
      {health && (
        <pre
          style={{
            background: "#f4f4f4",
            border: "1px solid #ddd",
            borderRadius: 6,
            padding: "1rem",
            fontSize: "0.9rem",
          }}
        >
          {JSON.stringify(health, null, 2)}
        </pre>
      )}
      <hr style={{ margin: "1.5rem 0" }} />
      <p>
        <Link href="/register">Register</Link> &nbsp;·&nbsp; <Link href="/login">Log in</Link>
      </p>
    </main>
  );
}
