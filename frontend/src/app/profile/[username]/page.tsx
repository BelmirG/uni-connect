"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";

interface Profile {
  username: string;
  display_name: string;
  bio: string | null;
  member_since: string;
  post_count: number;
  club_count: number;
  is_own_profile: boolean;
}

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

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function memberSince(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function Avatar({ name, size = 72 }: { name: string; size?: number }) {
  const letter = (name || "?")[0].toUpperCase();
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%",
        background: "#111", color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.4, fontWeight: "bold", flexShrink: 0,
      }}
    >
      {letter}
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { username } = useParams<{ username: string }>();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch<Profile>(`/api/users/${username}`),
      apiFetch<Post[]>(`/api/users/${username}/posts`),
    ])
      .then(([p, userPosts]) => {
        setProfile(p);
        setPosts(userPosts);
        setEditName(p.display_name);
        setEditBio(p.bio ?? "");
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) router.replace("/login");
        else if (err instanceof ApiError && err.status === 404) router.replace("/feed");
      })
      .finally(() => setLoading(false));
  }, [username, router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editName.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await apiFetch<{ display_name: string; bio: string | null }>("/api/users/me", {
        method: "PUT",
        body: JSON.stringify({ display_name: editName.trim(), bio: editBio.trim() }),
      });
      setProfile((prev) => prev ? { ...prev, display_name: updated.display_name, bio: updated.bio } : prev);
      setEditing(false);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await apiFetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  async function handleMessage() {
    if (!profile) return;
    try {
      const data = await apiFetch<{ conversation_id: string }>("/api/messages/open", {
        method: "POST",
        body: JSON.stringify({ username: profile.username }),
      });
      router.push(`/messages/${data.conversation_id}`);
    } catch { /* ignore */ }
  }

  if (loading) return <p style={{ padding: "2rem", color: "#888" }}>Loading…</p>;
  if (!profile) return null;

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "1.5rem 1rem" }}>
      {/* Profile header */}
      <div style={{ display: "flex", gap: "1.25rem", alignItems: "flex-start", marginBottom: "1.5rem" }}>
        <Avatar name={profile.display_name} size={72} />
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: "0 0 0.1rem", fontSize: "1.25rem" }}>{profile.display_name}</h1>
          <p style={{ margin: "0 0 0.4rem", color: "#888", fontSize: "0.9rem" }}>@{profile.username}</p>
          {profile.bio && !editing && (
            <p style={{ margin: "0 0 0.4rem", fontSize: "0.9rem", lineHeight: 1.4, whiteSpace: "pre-wrap" }}>
              {profile.bio}
            </p>
          )}
          <p style={{ margin: 0, fontSize: "0.78rem", color: "#bbb" }}>
            Joined {memberSince(profile.member_since)}
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: "1.5rem", marginBottom: "1.25rem", fontSize: "0.9rem" }}>
        <span><strong>{profile.post_count}</strong> <span style={{ color: "#888" }}>posts</span></span>
        <span><strong>{profile.club_count}</strong> <span style={{ color: "#888" }}>clubs</span></span>
      </div>

      {/* Action button */}
      {profile.is_own_profile ? (
        <button
          onClick={() => { setEditing((v) => !v); setSaveError(null); }}
          style={{ padding: "0.45rem 1.1rem", borderRadius: 6, border: "1px solid #ccc", background: "#fff", cursor: "pointer", fontSize: "0.9rem", marginBottom: "1.5rem" }}
        >
          {editing ? "Cancel" : "Edit profile"}
        </button>
      ) : (
        <button
          onClick={handleMessage}
          style={{ padding: "0.45rem 1.1rem", borderRadius: 6, border: "none", background: "#111", color: "#fff", cursor: "pointer", fontSize: "0.9rem", marginBottom: "1.5rem" }}
        >
          Message
        </button>
      )}

      {profile.is_own_profile && (
        <button
          onClick={handleLogout}
          style={{ display: "block", marginBottom: "1rem", background: "none", border: "none", cursor: "pointer", color: "#aaa", fontSize: "0.85rem", padding: 0 }}
        >
          Log out
        </button>
      )}

      {/* Inline edit form */}
      {editing && (
        <form onSubmit={handleSave} style={{ marginBottom: "1.5rem", padding: "1rem", border: "1px solid #e0e0e0", borderRadius: 8, background: "#fafafa", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.25rem", color: "#555" }}>Display name</label>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              maxLength={100}
              style={{ width: "100%", boxSizing: "border-box", padding: "0.45rem 0.6rem", fontSize: "0.95rem", border: "1px solid #ccc", borderRadius: 4, fontFamily: "inherit" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.25rem", color: "#555" }}>Bio</label>
            <textarea
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              rows={3}
              maxLength={300}
              placeholder="Tell people a bit about yourself…"
              style={{ width: "100%", boxSizing: "border-box", padding: "0.45rem 0.6rem", fontSize: "0.95rem", border: "1px solid #ccc", borderRadius: 4, fontFamily: "inherit", resize: "vertical" }}
            />
            <span style={{ fontSize: "0.75rem", color: "#bbb" }}>{editBio.length}/300</span>
          </div>
          {saveError && <p style={{ margin: 0, color: "crimson", fontSize: "0.88rem" }}>{saveError}</p>}
          <button
            type="submit"
            disabled={saving || !editName.trim()}
            style={{ alignSelf: "flex-start", padding: "0.45rem 1.1rem", borderRadius: 6, border: "none", background: "#111", color: "#fff", cursor: "pointer", fontSize: "0.9rem" }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </form>
      )}

      {/* Posts */}
      <h3 style={{ margin: "0 0 0.75rem", color: "#444", fontSize: "1rem" }}>Posts</h3>
      {posts.length === 0 && (
        <p style={{ color: "#aaa" }}>No posts yet.</p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {posts.map((post) => (
          <div key={post.id} style={{ border: "1px solid #e0e0e0", borderRadius: 8, padding: "0.85rem", background: "#fff" }}>
            <p style={{ margin: "0 0 0.6rem", whiteSpace: "pre-wrap", lineHeight: 1.5, fontSize: "0.95rem" }}>
              {post.content}
            </p>
            <div style={{ display: "flex", gap: "1rem", alignItems: "center", fontSize: "0.85rem", color: "#888" }}>
              <span>▲ {post.upvotes}</span>
              <span>▼ {post.downvotes}</span>
              <Link href={`/feed/${post.id}`} style={{ color: "#888", textDecoration: "none" }}>
                💬 {post.reply_count}
              </Link>
              <span style={{ marginLeft: "auto" }}>{timeAgo(post.created_at)}</span>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
