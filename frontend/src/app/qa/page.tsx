"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

interface QAPost {
  id: string;
  content: string;
  upvotes: number;
  downvotes: number;
  current_user_vote: "up" | "down" | null;
  reply_count: number;
  created_at: string;
}

interface QAListResponse {
  posts: QAPost[];
  total: number;
}

interface VoteResponse {
  upvotes: number;
  downvotes: number;
  current_user_vote: "up" | "down" | null;
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function QAPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<QAPost[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<QAListResponse>("/api/qa")
      .then((data) => { setPosts(data.posts); setTotal(data.total); })
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    setPostError(null);
    try {
      const newPost = await apiFetch<QAPost>("/api/qa", {
        method: "POST",
        body: JSON.stringify({ content: content.trim() }),
      });
      setPosts((prev) => [newPost, ...prev]);
      setTotal((t) => t + 1);
      setContent("");
    } catch (err: unknown) {
      setPostError(err instanceof Error ? err.message : "Failed to post.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVote(postId: string, voteType: "up" | "down") {
    try {
      const data = await apiFetch<VoteResponse>(`/api/qa/${postId}/vote`, {
        method: "POST",
        body: JSON.stringify({ vote_type: voteType }),
      });
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, upvotes: data.upvotes, downvotes: data.downvotes, current_user_vote: data.current_user_vote }
            : p
        )
      );
    } catch { /* non-critical */ }
  }

  const textareaStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "0.6rem",
    fontSize: "0.95rem",
    border: "1px solid #ccc",
    borderRadius: 4,
    fontFamily: "inherit",
    resize: "vertical",
  };

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "1.5rem 1rem" }}>
      <h1 style={{ margin: "0 0 0.5rem" }}>Anonymous Q&amp;A</h1>

      <p style={{ color: "#666", fontSize: "0.9rem", marginTop: 0, marginBottom: "1.5rem" }}>
        Questions and answers are completely anonymous. Your identity is never
        visible to other students. Administrators can see authorship only for
        moderation purposes.
      </p>

      {/* New question form */}
      <form onSubmit={handlePost} style={{ marginBottom: "2rem" }}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Ask a question anonymously…"
          rows={3}
          style={textareaStyle}
        />
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "0.5rem" }}>
          <button
            type="submit"
            disabled={submitting || !content.trim()}
            style={{ padding: "0.5rem 1.2rem", cursor: "pointer" }}
          >
            {submitting ? "Posting…" : "Post anonymously"}
          </button>
          <span style={{ fontSize: "0.82rem", color: "#999" }}>
            🔒 Your name will not be shown
          </span>
        </div>
        {postError && (
          <p style={{ color: "crimson", margin: "0.4rem 0 0", fontSize: "0.9rem" }}>
            {postError}
          </p>
        )}
      </form>

      {/* List */}
      {loading && <p style={{ color: "#888" }}>Loading…</p>}
      {!loading && posts.length === 0 && (
        <p style={{ color: "#888" }}>No questions yet. Ask one!</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {posts.map((post) => (
          <div
            key={post.id}
            style={{ border: "1px solid #e0e0e0", borderRadius: 8, padding: "1rem", background: "#fff" }}
          >
            <div style={{ fontSize: "0.82rem", color: "#999", marginBottom: "0.5rem" }}>
              Anonymous · {timeAgo(post.created_at)}
            </div>
            <p style={{ margin: "0 0 0.75rem", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
              {post.content}
            </p>
            <div style={{ display: "flex", gap: "1rem", alignItems: "center", fontSize: "0.9rem" }}>
              <button
                onClick={() => handleVote(post.id, "up")}
                style={{
                  background: "none", border: "none", cursor: "pointer", padding: 0,
                  color: post.current_user_vote === "up" ? "#e05c00" : "#555",
                  fontWeight: post.current_user_vote === "up" ? "bold" : "normal",
                }}
              >
                ▲ {post.upvotes}
              </button>
              <button
                onClick={() => handleVote(post.id, "down")}
                style={{
                  background: "none", border: "none", cursor: "pointer", padding: 0,
                  color: post.current_user_vote === "down" ? "#5555dd" : "#555",
                  fontWeight: post.current_user_vote === "down" ? "bold" : "normal",
                }}
              >
                ▼ {post.downvotes}
              </button>
              <Link href={`/qa/${post.id}`} style={{ color: "#555", textDecoration: "none" }}>
                💬 {post.reply_count} {post.reply_count === 1 ? "answer" : "answers"}
              </Link>
            </div>
          </div>
        ))}
      </div>

      {total > posts.length && (
        <p style={{ color: "#888", textAlign: "center", marginTop: "1rem" }}>
          Showing {posts.length} of {total} questions
        </p>
      )}
    </main>
  );
}
