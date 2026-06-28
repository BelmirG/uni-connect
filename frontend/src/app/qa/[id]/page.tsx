"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { FACULTY_NAMES, Faculty } from "@/lib/faculties";

interface QAPost {
  id: string;
  content: string;
  faculty_tag: string | null;
  upvotes: number;
  downvotes: number;
  current_user_vote: "up" | "down" | null;
  reply_count: number;
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

export default function QADetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [question, setQuestion] = useState<QAPost | null>(null);
  const [answers, setAnswers] = useState<QAPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [answerContent, setAnswerContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ question: QAPost; answers: QAPost[] }>(`/api/qa/${id}`)
      .then((data) => { setQuestion(data.question); setAnswers(data.answers); })
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [id, router]);

  async function handleVote(
    targetId: string,
    voteType: "up" | "down",
    isAnswer: boolean
  ) {
    try {
      const data = await apiFetch<VoteResponse>(`/api/qa/${targetId}/vote`, {
        method: "POST",
        body: JSON.stringify({ vote_type: voteType }),
      });
      const apply = (p: QAPost): QAPost =>
        p.id === targetId
          ? { ...p, upvotes: data.upvotes, downvotes: data.downvotes, current_user_vote: data.current_user_vote }
          : p;
      if (isAnswer) {
        setAnswers((prev) => prev.map(apply));
      } else {
        setQuestion((prev) => (prev ? apply(prev) : prev));
      }
    } catch { /* non-critical */ }
  }

  async function handleAnswer(e: React.FormEvent) {
    e.preventDefault();
    if (!answerContent.trim()) return;
    setSubmitting(true);
    setAnswerError(null);
    try {
      const newAnswer = await apiFetch<QAPost>(`/api/qa/${id}/answers`, {
        method: "POST",
        body: JSON.stringify({ content: answerContent.trim() }),
      });
      setAnswers((prev) => [...prev, newAnswer]);
      setQuestion((prev) =>
        prev ? { ...prev, reply_count: prev.reply_count + 1 } : prev
      );
      setAnswerContent("");
    } catch (err: unknown) {
      setAnswerError(err instanceof Error ? err.message : "Failed to post answer.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p style={{ padding: "2rem", color: "#888" }}>Loading…</p>;
  if (!question) return null;

  const cardStyle: React.CSSProperties = {
    border: "1px solid #e0e0e0",
    borderRadius: 8,
    padding: "1rem",
    background: "#fff",
  };

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "1.5rem 1rem" }}>
      <Link href="/qa" style={{ fontSize: "0.9rem" }}>← Back to Q&amp;A</Link>

      {/* Question */}
      <div style={{ ...cardStyle, margin: "1rem 0 1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.82rem", color: "#999", marginBottom: "0.5rem" }}>
          <span>Anonymous · {timeAgo(question.created_at)}</span>
          {question.faculty_tag && (
            <span style={{ fontSize: "0.72rem", fontWeight: "bold", padding: "0.15rem 0.5rem", borderRadius: 12, background: "#f0f0f0", color: "#444" }}>
              {question.faculty_tag}
            </span>
          )}
        </div>
        <p style={{ margin: "0 0 0.75rem", whiteSpace: "pre-wrap", lineHeight: 1.5, fontSize: "1.05rem" }}>
          {question.content}
        </p>
        <VoteBar post={question} onVote={(t) => handleVote(question.id, t, false)} />
      </div>

      {/* Answer form */}
      <form onSubmit={handleAnswer} style={{ marginBottom: "1.5rem" }}>
        <textarea
          value={answerContent}
          onChange={(e) => setAnswerContent(e.target.value)}
          placeholder="Write an anonymous answer…"
          rows={3}
          style={{
            width: "100%", boxSizing: "border-box", padding: "0.6rem",
            fontSize: "0.95rem", border: "1px solid #ccc", borderRadius: 4,
            fontFamily: "inherit", resize: "vertical",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "0.5rem" }}>
          <button
            type="submit"
            disabled={submitting || !answerContent.trim()}
            style={{ padding: "0.5rem 1.2rem", cursor: "pointer" }}
          >
            {submitting ? "Posting…" : "Answer anonymously"}
          </button>
          <span style={{ fontSize: "0.82rem", color: "#999" }}>
            🔒 Your name will not be shown
          </span>
        </div>
        {answerError && (
          <p style={{ color: "crimson", margin: "0.4rem 0 0", fontSize: "0.9rem" }}>
            {answerError}
          </p>
        )}
      </form>

      {/* Answers */}
      <h3 style={{ color: "#444", marginBottom: "0.75rem" }}>
        {answers.length} {answers.length === 1 ? "answer" : "answers"}
      </h3>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {answers.map((answer) => (
          <div
            key={answer.id}
            style={{ ...cardStyle, background: answer.is_deleted ? "#fafafa" : "#fff" }}
          >
            {answer.is_deleted ? (
              <p style={{ color: "#aaa", margin: 0, fontStyle: "italic" }}>[deleted]</p>
            ) : (
              <>
                <div style={{ fontSize: "0.82rem", color: "#999", marginBottom: "0.4rem" }}>
                  Anonymous · {timeAgo(answer.created_at)}
                </div>
                <p style={{ margin: "0 0 0.6rem", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                  {answer.content}
                </p>
                <VoteBar post={answer} onVote={(t) => handleVote(answer.id, t, true)} />
              </>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}

function VoteBar({ post, onVote }: { post: QAPost; onVote: (t: "up" | "down") => void }) {
  return (
    <div style={{ display: "flex", gap: "1rem", fontSize: "0.9rem" }}>
      <button
        onClick={() => onVote("up")}
        style={{
          background: "none", border: "none", cursor: "pointer", padding: 0,
          color: post.current_user_vote === "up" ? "#e05c00" : "#555",
          fontWeight: post.current_user_vote === "up" ? "bold" : "normal",
        }}
      >
        ▲ {post.upvotes}
      </button>
      <button
        onClick={() => onVote("down")}
        style={{
          background: "none", border: "none", cursor: "pointer", padding: 0,
          color: post.current_user_vote === "down" ? "#5555dd" : "#555",
          fontWeight: post.current_user_vote === "down" ? "bold" : "normal",
        }}
      >
        ▼ {post.downvotes}
      </button>
    </div>
  );
}
