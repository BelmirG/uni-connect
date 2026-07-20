"use client";

import { useState } from "react";
import { CalendarDays, MapPin } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface EventInfo {
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  going_count: number;
  interested_count: number;
  user_status: "going" | "interested" | null;
  is_past: boolean;
}

interface Props {
  postId: string;
  event: EventInfo;
  onUpdate: (updated: EventInfo) => void;
}

/** "Thu, 14 Mar · 18:00" — weekday and time are what people actually scan for.
 *  The year only appears when the event isn't in the current year. */
function formatWhen(startIso: string, endIso: string | null): string {
  const start = new Date(startIso);
  const sameYear = start.getFullYear() === new Date().getFullYear();
  const date = start.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const time = start.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  if (!endIso) return `${date} · ${time}`;

  const end = new Date(endIso);
  const endTime = end.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  // Same-day events show one date and a time range; multi-day spell out both.
  if (end.toDateString() === start.toDateString()) return `${date} · ${time}–${endTime}`;
  const endDate = end.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  return `${date} ${time} → ${endDate} ${endTime}`;
}

export default function EventDisplay({ postId, event, onUpdate }: Props) {
  const [loading, setLoading] = useState(false);

  async function respond(status: "going" | "interested") {
    if (loading) return;
    setLoading(true);
    try {
      const updated = await apiFetch<EventInfo>(`/api/posts/${postId}/rsvp`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      onUpdate(updated);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Could not save your RSVP.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={cn(
        "mt-3 rounded-xl border border-border overflow-hidden",
        event.is_past && "opacity-70"
      )}
    >
      <div className="flex items-start gap-2.5 px-3 py-2.5 bg-muted/40">
        <CalendarDays className="w-4 h-4 mt-0.5 text-foreground flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground leading-snug">
            {formatWhen(event.starts_at, event.ends_at)}
            {event.is_past && (
              <span className="ml-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Past
              </span>
            )}
          </p>
          {event.location && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{event.location}</span>
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 py-2 border-t border-border">
        {(["going", "interested"] as const).map((status) => {
          const active = event.user_status === status;
          const count = status === "going" ? event.going_count : event.interested_count;
          return (
            <button
              key={status}
              type="button"
              onClick={() => respond(status)}
              disabled={loading}
              className={cn(
                "flex-1 text-xs font-medium py-1.5 rounded-md border transition-colors disabled:opacity-50 capitalize",
                active
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-border hover:border-foreground hover:text-foreground"
              )}
            >
              {status}
              {count > 0 && <span className="ml-1 tabular-nums">{count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
