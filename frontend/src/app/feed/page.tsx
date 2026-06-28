"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import UserSearchInput from "@/components/UserSearchInput";
import { FACULTIES, FACULTY_NAMES, Faculty } from "@/lib/faculties";

interface Author {
  username: string;
  display_name: string;
}

interface Post {
  id: string;
  content: string;
  faculty_tag: string | null;
  author: Author | null;
  upvotes: number;
  downvotes: number;
  current_user_vote: "up" | "down" | null;
  reply_count: number;
  share_count: number;
  created_at: string;
}

interface PostListResponse {
  posts: Post[];
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

function FacultyBadge({ tag }: { tag: string }) {
  return (
    <span style={{
      fontSize: "0.72rem", fontWeight: "bold", letterSpacing: "0.03em",
      padding: "0.15rem 0.5rem", borderRadius: 12,
      background: "#f0f0f0", color: "#444", flexShrink: 0,
    }}>
      {tag}
    </span>
  );
}

export default function FeedPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<"hot" | "new">("hot");
  const [facultyFilter, setFacultyFilter] = useState<Faculty | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [postFacultyTag, setPostFacultyTag] = useState<Faculty | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setLoading(true);
    const facultyParam = facultyFilter ? `&faculty=${facultyFilter}` : "";
    Promise.all([
      apiFetch<PostListResponse>(`/api/posts?sort=${sort}${facultyParam}`),
      apiFetch<{ username: string }>("/api/auth/me"),
    ])
      .then(([postsData, me]) => {
        setPosts(postsData.posts);
        setTotal(postsData.total);
        setCurrentUsername(me.username);
      })
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [sort, facultyFilter, router]);

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    setPostError(null);
    try {
      const newPost = await apiFetch<Post>("/api/posts", {
        method: "POST",
        body: JSON.stringify({
          content: content.trim(),
          faculty_tag: postFacultyTag || null,
        }),
      });
      setPosts((prev) => [newPost, ...prev]);
      setTotal((t) => t + 1);
      setContent("");
      setPostFacultyTag("");
    } catch (err: unknown) {
      setPostError(err instanceof Error ? err.message : "Failed to post.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVote(postId: string, voteType: "up" | "down") {
    try {
      const data = await apiFetch<VoteResponse>(`/api/posts/${postId}/vote`, {
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

  async function handleDelete(postId: string) {
    try {
      await apiFetch(`/api/posts/${postId}`, { method: "DELETE" });
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setTotal((t) => t - 1);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Could not delete post.");
    }
  }

  const inputStyle: React.CSSProperties = {
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
      <h1 style={{ margin: "0 0 1.5rem" }}>Feed</h1>

      {/* Compose */}
      <form onSubmit={handlePost} style={{ marginBottom: "2rem" }}>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's on your mind?"
          rows={3}
          style={inputStyle}
        />
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
          <select
            value={postFacultyTag}
            onChange={(e) => setPostFacultyTag(e.target.value as Faculty | "")}
            style={{
              padding: "0.4rem 0.6rem", fontSize: "0.88rem", border: "1px solid #ccc",
              borderRadius: 4, fontFamily: "inherit", color: postFacultyTag ? "#111" : "#888",
              background: "#fff",
            }}
          >
            <option value="">Tag faculty (optional)</option>
            {FACULTIES.map((f) => (
              <option key={f} value={f}>{f} — {FACULTY_NAMES[f]}</option>
            ))}
          </select>
          {postError && (
            <p style={{ color: "crimson", margin: 0, fontSize: "0.9rem" }}>{postError}</p>
          )}
          <button
            type="submit"
            disabled={submitting || !content.trim()}
            style={{ marginLeft: "auto", padding: "0.5rem 1.2rem", cursor: "pointer" }}
          >
            {submitting ? "Posting…" : "Post"}
          </button>
        </div>
      </form>

      {/* Sort + faculty filter */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
        {(["hot", "new"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            style={{
              padding: "0.35rem 0.9rem", fontSize: "0.9rem", cursor: "pointer",
              borderRadius: 20, border: "1px solid #ccc",
              background: sort === s ? "#111" : "#fff",
              color: sort === s ? "#fff" : "#555",
              fontWeight: sort === s ? "bold" : "normal",
            }}
          >
            {s === "hot" ? "Hot" : "New"}
          </button>
        ))}
      </div>

      {/* Faculty filter pills */}
      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        <button
          onClick={() => setFacultyFilter(null)}
          style={{
            padding: "0.25rem 0.75rem", fontSize: "0.8rem", cursor: "pointer",
            borderRadius: 20, border: "1px solid #ccc",
            background: facultyFilter === null ? "#111" : "#fff",
            color: facultyFilter === null ? "#fff" : "#555",
          }}
        >
          All
        </button>
        {FACULTIES.map((f) => (
          <button
            key={f}
            onClick={() => setFacultyFilter(facultyFilter === f ? null : f)}
            style={{
              padding: "0.25rem 0.75rem", fontSize: "0.8rem", cursor: "pointer",
              borderRadius: 20, border: "1px solid #ccc",
              background: facultyFilter === f ? "#111" : "#fff",
              color: facultyFilter === f ? "#fff" : "#555",
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {loading && <p style={{ color: "#888" }}>Loading…</p>}
      {!loading && posts.length === 0 && (
        <p style={{ color: "#888" }}>
          {facultyFilter ? `No posts tagged ${facultyFilter} yet.` : "No posts yet. Be the first!"}
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            currentUsername={currentUsername}
            onVote={handleVote}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {total > posts.length && (
        <p style={{ color: "#888", textAlign: "center", marginTop: "1rem" }}>
          Showing {posts.length} of {total} posts
        </p>
      )}
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

function PostCard({
  post,
  currentUsername,
  onVote,
  onDelete,
}: {
  post: Post;
  currentUsername: string | null;
  onVote: (id: string, type: "up" | "down") => void;
  onDelete: (id: string) => void;
}) {
  const voted = post.current_user_vote;
  const isOwn = currentUsername !== null && post.author?.username === currentUsername;

  return (
    <div style={{ border: "1px solid #e0e0e0", borderRadius: 8, padding: "1rem", background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", color: "#666", marginBottom: "0.5rem" }}>
        <span>
          <strong style={{ color: "#222" }}>{post.author?.display_name ?? "Unknown"}</strong>{" "}
          @{post.author?.username ?? "?"} · {timeAgo(post.created_at)}
        </span>
        {post.faculty_tag && <FacultyBadge tag={post.faculty_tag} />}
      </div>
      <p style={{ margin: "0 0 0.75rem", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
        {post.content}
      </p>
      <div style={{ display: "flex", gap: "1rem", alignItems: "center", fontSize: "0.9rem", flexWrap: "wrap" }}>
        <button
          onClick={() => onVote(post.id, "up")}
          style={{
            background: "none", border: "none", cursor: "pointer", padding: 0,
            color: voted === "up" ? "#e05c00" : "#555",
            fontWeight: voted === "up" ? "bold" : "normal",
          }}
        >
          ▲ {post.upvotes}
        </button>
        <button
          onClick={() => onVote(post.id, "down")}
          style={{
            background: "none", border: "none", cursor: "pointer", padding: 0,
            color: voted === "down" ? "#5555dd" : "#555",
            fontWeight: voted === "down" ? "bold" : "normal",
          }}
        >
          ▼ {post.downvotes}
        </button>
        <Link href={`/feed/${post.id}`} style={{ color: "#555", textDecoration: "none" }}>
          💬 {post.reply_count} {post.reply_count === 1 ? "reply" : "replies"}
        </Link>
        <SharePanel postId={post.id} shareCount={post.share_count} />
        {isOwn && (
          <button
            onClick={() => onDelete(post.id)}
            style={{
              marginLeft: "auto", background: "none", border: "none",
              cursor: "pointer", padding: 0, color: "#ccc", fontSize: "0.85rem",
            }}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
