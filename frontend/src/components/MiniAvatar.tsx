"use client";

import { cn } from "@/lib/utils";
import ThumbImg from "@/components/ThumbImg";

export default function MiniAvatar({
  name,
  url,
  size = 32,
  className,
}: {
  name: string;
  url: string | null;
  size?: number;
  className?: string;
}) {
  const dim = `${size}px`;

  if (url)
    return (
      <ThumbImg
        src={url}
        alt=""
        loading="lazy"
        decoding="async"
        className={cn("rounded-full object-cover flex-shrink-0", className)}
        style={{ width: dim, height: dim }}
      />
    );

  return (
    <div
      className={cn(
        "rounded-full bg-foreground text-background flex items-center justify-center font-bold flex-shrink-0",
        className
      )}
      style={{ width: dim, height: dim, fontSize: size * 0.38 }}
    >
      {(name || "?")[0].toUpperCase()}
    </div>
  );
}
