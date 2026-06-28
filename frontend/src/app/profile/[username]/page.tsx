"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import { FACULTIES, FACULTY_NAMES, FACULTY_PROGRAMS, Faculty } from "@/lib/faculties";

interface Profile {
  username: string;
  display_name: string;
  bio: string | null;
  faculty: string | null;
  program: string | null;
  member_since: string;
  post_count: number;
  club_count: number;
  follower_count: number;
  following_count: number;
  is_following: boolean;
  is_own_profile: boolean;
}

interface UserClub {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_private: boolean;
  role: string;
}

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
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: "#111", color: "#fff",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.4, fontWeight: "bold", flexShrink: 0,
    }}>
      {letter}
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { username } = useParams<{ username: string }>();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [clubs, setClubs] = useState<UserClub[]>([]);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editFaculty, setEditFaculty] = useState<Faculty | "">("");
  const [editProgram, setEditProgram] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch<Profile>(`/api/users/${username}`),
      apiFetch<Post[]>(`/api/users/${username}/posts`),
      apiFetch<UserClub[]>(`/api/users/${username}/clubs`),
    ])
      .then(([p, userPosts, userClubs]) => {
        setProfile(p);
        setPosts(userPosts);
        setClubs(userClubs);
        setEditName(p.display_name);
        setEditBio(p.bio ?? "");
        setEditFaculty((p.faculty as Faculty) ?? "");
        setEditProgram(p.program ?? "");
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
      const updated = await apiFetch<{ display_name: string; bio: string | null; faculty: string | null; program: string | null }>("/api/users/me", {
        method: "PUT",
        body: JSON.stringify({
          display_name: editName.trim(),
          bio: editBio.trim(),
          faculty: editFaculty || null,
          program: editProgram.trim() || null,
        }),
      });
      setProfile((prev) => prev ? {
        ...prev,
        display_name: updated.display_name,
        bio: updated.bio,
        faculty: updated.faculty,
        program: updated.program,
      } : prev);
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

  async function handleFollow() {
    if (!profile || followLoading) return;
    setFollowLoading(true);
    try {
      if (profile.is_following) {
        await apiFetch(`/api/users/${profile.username}/follow`, { method: "DELETE" });
        setProfile((prev) => prev ? {
          ...prev,
          is_following: false,
          follower_count: prev.follower_count - 1,
        } : prev);
      } else {
        await apiFetch(`/api/users/${profile.username}/follow`, { method: "POST" });
        setProfile((prev) => prev ? {
          ...prev,
          is_following: true,
          follower_count: prev.follower_count + 1,
        } : prev);
      }
    } catch { /* ignore */ }
    finally { setFollowLoading(false); }
  }

  if (loading) return <p style={{ padding: "2rem", color: "#888" }}>Loading…</p>;
  if (!profile) return null;

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "1.5rem 1rem" }}>

      {/* Profile header */}
      <div style={{ display: "flex", gap: "1.25rem", alignItems: "flex-start", marginBottom: "1.25rem" }}>
        <Avatar name={profile.display_name} size={72} />
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: "0 0 0.1rem", fontSize: "1.25rem" }}>{profile.display_name}</h1>
          <p style={{ margin: "0 0 0.25rem", color: "#888", fontSize: "0.9rem" }}>@{profile.username}</p>
          {profile.faculty && !editing && (
            <p style={{ margin: "0 0 0.25rem", fontSize: "0.85rem", color: "#555", fontWeight: 500 }}>
              {profile.faculty} · {profile.program ?? FACULTY_NAMES[profile.faculty as Faculty]}
            </p>
          )}
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
        <span><strong>{profile.follower_count}</strong> <span style={{ color: "#888" }}>followers</span></span>
        <span><strong>{profile.following_count}</strong> <span style={{ color: "#888" }}>following</span></span>
      </div>

      {/* Action buttons */}
      {profile.is_own_profile ? (
        <div style={{ display: "flex", gap: "0.6rem", marginBottom: "1.5rem", alignItems: "center" }}>
          <button
            onClick={() => { setEditing((v) => !v); setSaveError(null); }}
            style={{ padding: "0.45rem 1.1rem", borderRadius: 6, border: "1px solid #ccc", background: "#fff", cursor: "pointer", fontSize: "0.9rem" }}
          >
            {editing ? "Cancel" : "Edit profile"}
          </button>
          <button
            onClick={handleLogout}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa", fontSize: "0.85rem", padding: 0 }}
          >
            Log out
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: "0.6rem", marginBottom: "1.5rem" }}>
          <button
            onClick={handleFollow}
            disabled={followLoading}
            style={{
              padding: "0.45rem 1.1rem", borderRadius: 6, fontSize: "0.9rem", cursor: "pointer",
              border: profile.is_following ? "1px solid #ccc" : "none",
              background: profile.is_following ? "#fff" : "#111",
              color: profile.is_following ? "#111" : "#fff",
            }}
          >
            {profile.is_following ? "Following" : "Follow"}
          </button>
          <button
            onClick={handleMessage}
            style={{ padding: "0.45rem 1.1rem", borderRadius: 6, border: "1px solid #ccc", background: "#fff", cursor: "pointer", fontSize: "0.9rem" }}
          >
            Message
          </button>
        </div>
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
          <div>
            <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.25rem", color: "#555" }}>Faculty</label>
            <select
              value={editFaculty}
              onChange={(e) => { setEditFaculty(e.target.value as Faculty | ""); setEditProgram(""); }}
              style={{ width: "100%", boxSizing: "border-box", padding: "0.45rem 0.6rem", fontSize: "0.95rem", border: "1px solid #ccc", borderRadius: 4, fontFamily: "inherit" }}
            >
              <option value="">Not specified</option>
              {FACULTIES.map((f) => (
                <option key={f} value={f}>{f} — {FACULTY_NAMES[f]}</option>
              ))}
            </select>
          </div>
          {editFaculty && (
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.25rem", color: "#555" }}>Program</label>
              <select
                value={editProgram}
                onChange={(e) => setEditProgram(e.target.value)}
                style={{ width: "100%", boxSizing: "border-box", padding: "0.45rem 0.6rem", fontSize: "0.95rem", border: "1px solid #ccc", borderRadius: 4, fontFamily: "inherit" }}
              >
                <option value="">Select program</option>
                {FACULTY_PROGRAMS[editFaculty].map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          )}
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

      {/* Clubs */}
      {clubs.length > 0 && (
        <>
          <h3 style={{ margin: "0 0 0.6rem", color: "#444", fontSize: "1rem" }}>Clubs</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "1.5rem" }}>
            {clubs.map((club) => (
              <Link
                key={club.id}
                href={`/clubs/${club.slug}`}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem 0.85rem", border: "1px solid #e0e0e0", borderRadius: 8, background: "#fff", textDecoration: "none", color: "inherit" }}
              >
                <div>
                  <span style={{ fontWeight: 500, fontSize: "0.95rem" }}>{club.name}</span>
                  {club.is_private && (
                    <span style={{ marginLeft: "0.4rem", fontSize: "0.72rem", color: "#888", background: "#f0f0f0", padding: "0.1rem 0.35rem", borderRadius: 4 }}>Private</span>
                  )}
                </div>
                <span style={{ fontSize: "0.78rem", color: "#aaa", textTransform: "capitalize" }}>{club.role}</span>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Posts */}
      <h3 style={{ margin: "0 0 0.75rem", color: "#444", fontSize: "1rem" }}>Posts</h3>
      {posts.length === 0 && (
        <p style={{ color: "#aaa" }}>No posts yet.</p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {posts.map((post) => (
          <div key={post.id} style={{ border: "1px solid #e0e0e0", borderRadius: 8, padding: "0.85rem", background: "#fff" }}>
            {post.faculty_tag && (
              <span style={{ fontSize: "0.72rem", fontWeight: "bold", padding: "0.15rem 0.5rem", borderRadius: 12, background: "#f0f0f0", color: "#444", marginBottom: "0.5rem", display: "inline-block" }}>
                {post.faculty_tag}
              </span>
            )}
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
