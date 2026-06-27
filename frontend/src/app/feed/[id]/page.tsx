"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import UserSearchInput from "@/components/UserSearchInput";

interface Author {
  username: string;
  display_name: string;
}

interface Post {
  id: string;
  content: string;
  author: Author | null;
  upvotes: number;
  downvotes: number;
  current_user_vote: "up" | "down" | null;
  reply_count: number;
  share_count: number;
  created_at: string;
  is_deleted: boolean;
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

export default function PostDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [post, setPost] = useState<Post | null>(null);
  const [replies, setReplies] = useState<Post[]>([]);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyContent, setReplyContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<{ post: Post; replies: Post[] }>(`/api/posts/${id}`),
      apiFetch<{ username: string }>("/api/auth/me"),
    ])
      .then(([data, me]) => {
        setPost(data.post);
        setReplies(data.replies);
        setCurrentUsername(me.username);
      })
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [id, router]);

  async function handleVote(targetId: string, voteType: "up" | "down", isReply: boolean) {
    try {
      const data = await apiFetch<VoteResponse>(`/api/posts/${targetId}/vote`, {
        method: "POST",
        body: JSON.stringify({ vote_type: voteType }),
      });
      const apply = (p: Post): Post =>
        p.id === targetId
          ? { ...p, upvotes: data.upvotes, downvotes: data.downvotes, current_user_vote: data.current_user_vote }
          : p;
      if (isReply) {
        setReplies((prev) => prev.map(apply));
      } else {
        setPost((prev) => (prev ? apply(prev) : prev));
      }
    } catch { /* non-critical */ }
  }

  async function handleDeletePost() {
    if (!post) return;
    try {
      await apiFetch(`/api/posts/${post.id}`, { method: "DELETE" });
      setPost((prev) => prev ? { ...prev, is_deleted: true, content: "[deleted]" } : prev);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Could not delete post.");
    }
  }

  async function handleDeleteReply(replyId: string) {
    try {
      await apiFetch(`/api/posts/${replyId}`, { method: "DELETE" });
      setReplies((prev) =>
        prev.map((r) => r.id === replyId ? { ...r, is_deleted: true, content: "[deleted]" } : r)
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Could not delete reply.");
    }
  }

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyContent.trim()) return;
    setSubmitting(true);
    setReplyError(null);
    try {
      const newReply = await apiFetch<Post>(`/api/posts/${id}/replies`, {
        method: "POST",
        body: JSON.stringify({ content: replyContent.trim() }),
      });
      setReplies((prev) => [...prev, newReply]);
      setPost((prev) => prev ? { ...prev, reply_count: prev.reply_count + 1 } : prev);
      setReplyContent("");
    } catch (err: unknown) {
      setReplyError(err instanceof Error ? err.message : "Failed to post reply.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p style={{ padding: "2rem", color: "#888" }}>Loading…</p>;
  if (!post) return null;

  const isOwnPost = currentUsername !== null && post.author?.username === currentUsername;

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "1.5rem 1rem" }}>
      <Link href="/feed" style={{ fontSize: "0.9rem" }}>← Back to feed</Link>

      {/* Original post */}
      <div style={{ border: "1px solid #e0e0e0", borderRadius: 8, padding: "1rem", margin: "1rem 0", background: "#fff" }}>
        {post.is_deleted ? (
          <p style={{ color: "#aaa", margin: 0, fontStyle: "italic" }}>[deleted]</p>
        ) : (
          <>
            <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.5rem" }}>
              <strong style={{ color: "#222" }}>{post.author?.display_name ?? "Unknown"}</strong>{" "}
              @{post.author?.username ?? "?"} · {timeAgo(post.created_at)}
            </div>
            <p style={{ margin: "0 0 0.75rem", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
              {post.content}
            </p>
            <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
              <VoteBar post={post} onVote={(t) => handleVote(post.id, t, false)} />
              <SharePanel postId={post.id} shareCount={post.share_count} />
              {isOwnPost && (
                <button
                  onClick={handleDeletePost}
                  style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", padding: 0, color: "#ccc", fontSize: "0.85rem" }}
                >
                  Delete
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Reply form */}
      <form onSubmit={handleReply} style={{ margin: "1.5rem 0" }}>
        <textarea
          value={replyContent}
          onChange={(e) => setReplyContent(e.target.value)}
          placeholder="Write a reply…"
          rows={3}
          style={{
            width: "100%", boxSizing: "border-box", padding: "0.6rem",
            fontSize: "0.95rem", border: "1px solid #ccc", borderRadius: 4,
            fontFamily: "inherit", resize: "vertical",
          }}
        />
        {replyError && (
          <p style={{ color: "crimson", margin: "0.25rem 0", fontSize: "0.9rem" }}>{replyError}</p>
        )}
        <button
          type="submit"
          disabled={submitting || !replyContent.trim()}
          style={{ marginTop: "0.5rem", padding: "0.5rem 1.2rem", cursor: "pointer" }}
        >
          {submitting ? "Posting…" : "Reply"}
        </button>
      </form>

      {/* Replies */}
      <h3 style={{ color: "#444", marginBottom: "0.75rem" }}>
        {replies.length} {replies.length === 1 ? "reply" : "replies"}
      </h3>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {replies.map((reply) => {
          const isOwnReply = currentUsername !== null && reply.author?.username === currentUsername;
          return (
            <div
              key={reply.id}
              style={{ border: "1px solid #e8e8e8", borderRadius: 8, padding: "0.85rem", background: reply.is_deleted ? "#fafafa" : "#fff" }}
            >
              {reply.is_deleted ? (
                <p style={{ color: "#aaa", margin: 0, fontStyle: "italic" }}>[deleted]</p>
              ) : (
                <>
                  <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.4rem" }}>
                    <strong style={{ color: "#222" }}>{reply.author?.display_name ?? "Unknown"}</strong>{" "}
                    @{reply.author?.username ?? "?"} · {timeAgo(reply.created_at)}
                  </div>
                  <p style={{ margin: "0 0 0.6rem", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                    {reply.content}
                  </p>
                  <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
                    <VoteBar post={reply} onVote={(t) => handleVote(reply.id, t, true)} />
                    <SharePanel postId={reply.id} shareCount={reply.share_count} />
                    {isOwnReply && (
                      <button
                        onClick={() => handleDeleteReply(reply.id)}
                        style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", padding: 0, color: "#ccc", fontSize: "0.85rem" }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}

function SharePanel({ postId, shareCount }: { postId: string; shareCount: number }) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [msg, setMsg] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleShare(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;
    setStatus("sending");
    setError(null);
    try {
      await apiFetch("/api/messages/share", {
        method: "POST",
        body: JSON.stringify({ recipient_username: username.trim(), post_id: postId, content: msg.trim() }),
      });
      setStatus("sent");
      setTimeout(() => { setStatus("idle"); setOpen(false); setUsername(""); setMsg(""); }, 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not share.");
      setStatus("error");
    }
  }

  return (
    <span>
      <button
        onClick={() => { setOpen((v) => !v); setStatus("idle"); setError(null); }}
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#555", fontSize: "0.9rem" }}
      >
        ↗ {shareCount > 0 ? shareCount : "Share"}
      </button>
      {open && (
        <form
          onSubmit={handleShare}
          style={{ marginTop: "0.65rem", padding: "0.75rem", border: "1px solid #e0e0e0", borderRadius: 6, background: "#fafafa", display: "flex", flexDirection: "column", gap: "0.4rem" }}
        >
          <UserSearchInput
            value={username}
            onChange={setUsername}
            onSelect={(u) => setUsername(u)}
            placeholder="Search by name or username"
          />
          <input
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder="Add a message (optional)"
            style={{ padding: "0.4rem 0.6rem", fontSize: "0.88rem", border: "1px solid #ccc", borderRadius: 4, fontFamily: "inherit" }}
          />
          {error && <p style={{ margin: 0, fontSize: "0.82rem", color: "crimson" }}>{error}</p>}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="submit"
              disabled={status === "sending" || !username.trim()}
              style={{ padding: "0.35rem 0.8rem", fontSize: "0.85rem", cursor: "pointer", background: "#111", color: "#fff", border: "none", borderRadius: 4 }}
            >
              {status === "sending" ? "Sharing…" : status === "sent" ? "Shared!" : "Share"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ padding: "0.35rem 0.8rem", fontSize: "0.85rem", cursor: "pointer", background: "none", border: "1px solid #ccc", borderRadius: 4 }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </span>
  );
}

function VoteBar({ post, onVote }: { post: Post; onVote: (type: "up" | "down") => void }) {
  const voted = post.current_user_vote;
  return (
    <div style={{ display: "flex", gap: "1rem", fontSize: "0.9rem" }}>
      <button
        onClick={() => onVote("up")}
        style={{
          background: "none", border: "none", cursor: "pointer", padding: 0,
          color: voted === "up" ? "#e05c00" : "#555",
          fontWeight: voted === "up" ? "bold" : "normal",
        }}
      >
        ▲ {post.upvotes}
      </button>
      <button
        onClick={() => onVote("down")}
        style={{
          background: "none", border: "none", cursor: "pointer", padding: 0,
          color: voted === "down" ? "#5555dd" : "#555",
          fontWeight: voted === "down" ? "bold" : "normal",
        }}
      >
        ▼ {post.downvotes}
      </button>
    </div>
  );
}
