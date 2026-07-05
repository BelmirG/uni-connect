"use client";

import { useState } from "react";

// Next.js remounts this on every navigation, which is what replays the
// entrance animation per page. The animation itself briefly applies a
// `transform`, and CSS spec makes any transformed ancestor the containing
// block for `position: fixed` descendants — so every fixed-centered modal on
// the page (followers list, share panel, etc.) would silently position itself
// against this div instead of the real viewport, for as long as the class
// stays attached. Dropping the class once the transition finishes removes
// that side effect for the rest of the page's life.
export default function Template({ children }: { children: React.ReactNode }) {
  const [animating, setAnimating] = useState(true);

  return (
    <div
      className={animating ? "page-enter" : undefined}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) setAnimating(false);
      }}
    >
      {children}
    </div>
  );
}
