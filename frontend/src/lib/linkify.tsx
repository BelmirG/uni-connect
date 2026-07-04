import { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// Matches http(s):// URLs, bare www. links, and @username mentions in one pass.
// Mention charset mirrors the backend (letters, digits, underscores, 3+ chars).
// The captured prefix char (group 2) stops the domain half of an email reading
// as a mention — written without lookbehind, which old Safari can't parse.
const TOKEN_RE = /(https?:\/\/[^\s]+|www\.[^\s]+)|(^|[^a-zA-Z0-9_.])@([a-zA-Z0-9_]{3,50})/gi;
// Trailing punctuation that shouldn't be swallowed into the link.
const TRAILING = /[.,!?;:)\]}'"]+$/;

/**
 * Render text with URLs and @mentions turned into clickable links.
 * URLs open in a new tab; mentions navigate to the tagged user's profile.
 * Both stop propagation (so tapping a link inside a chat bubble doesn't trigger
 * swipe-to-reply) and break-all so long URLs can't blow out the layout width.
 */
export function Linkify({ text, isOwn }: { text: string; isOwn?: boolean }) {
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  const re = new RegExp(TOKEN_RE);
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    const start = m.index;
    if (start > last) nodes.push(text.slice(last, start));

    if (m[3] !== undefined) {
      // @mention → profile link. Group 2 is the boundary char before the "@"
      // (or "" at line start) — it's part of the match, so emit it as plain text.
      if (m[2]) nodes.push(m[2]);
      nodes.push(
        <Link
          key={key++}
          href={`/profile/${m[3]}`}
          onClick={(e) => e.stopPropagation()}
          className={cn("font-semibold no-underline", isOwn ? "text-white underline underline-offset-2" : "text-secondary")}
        >
          @{m[3]}
        </Link>
      );
    } else {
      let url = m[0];
      let trailing = "";
      const t = url.match(TRAILING);
      if (t) {
        trailing = t[0];
        url = url.slice(0, -trailing.length);
      }
      const href = url.startsWith("http") ? url : `https://${url}`;
      nodes.push(
        <a
          key={key++}
          href={href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          onClick={(e) => e.stopPropagation()}
          className={cn("underline underline-offset-2 break-all", isOwn ? "text-white" : "text-secondary")}
        >
          {url}
        </a>
      );
      if (trailing) nodes.push(trailing);
    }
    last = start + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));

  return <span className="whitespace-pre-wrap break-words">{nodes}</span>;
}
