"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isImmersiveRoute } from "@/lib/immersive";

// Zeroes the body's bottom padding (normally pb-24, reserved for the floating
// NavBar) on immersive chat routes, so the chat fills the whole viewport.
export default function BodyChrome() {
  const pathname = usePathname();
  const immersive = isImmersiveRoute(pathname);

  useEffect(() => {
    document.body.style.paddingBottom = immersive ? "0px" : "";
    return () => { document.body.style.paddingBottom = ""; };
  }, [immersive]);

  return null;
}
