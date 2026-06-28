"use client";
import { useState } from "react";

export function ImageGrid({ urls }: { urls: string[] }) {
  const [index, setIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  if (!urls.length) return null;

  if (urls.length === 1) {
    return (
      <div style={{ marginBottom: "0.65rem", borderRadius: 8, overflow: "hidden" }}>
        <a href={urls[0]} target="_blank" rel="noopener noreferrer" style={{ display: "block" }}>
          <img src={urls[0]} alt="" style={{ width: "100%", maxHeight: 500, objectFit: "cover", display: "block" }} />
        </a>
      </div>
    );
  }

  function prev() { setIndex((i) => Math.max(0, i - 1)); }
  function next() { setIndex((i) => Math.min(urls.length - 1, i + 1)); }

  return (
    <div style={{ marginBottom: "0.65rem", userSelect: "none" }}>
      <div
        style={{ position: "relative", borderRadius: 8, overflow: "hidden", background: "#111" }}
        onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchStartX === null) return;
          const dx = touchStartX - e.changedTouches[0].clientX;
          if (dx > 40) next();
          else if (dx < -40) prev();
          setTouchStartX(null);
        }}
      >
        <a href={urls[index]} target="_blank" rel="noopener noreferrer" style={{ display: "block" }}>
          <img
            src={urls[index]}
            alt={`Image ${index + 1} of ${urls.length}`}
            style={{ width: "100%", maxHeight: 420, objectFit: "cover", display: "block" }}
          />
        </a>

        {index > 0 && (
          <button
            onClick={(e) => { e.preventDefault(); prev(); }}
            style={{
              position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
              background: "rgba(0,0,0,0.5)", color: "#fff", border: "none", borderRadius: "50%",
              width: 32, height: 32, cursor: "pointer", fontSize: "1.2rem",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >‹</button>
        )}

        {index < urls.length - 1 && (
          <button
            onClick={(e) => { e.preventDefault(); next(); }}
            style={{
              position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
              background: "rgba(0,0,0,0.5)", color: "#fff", border: "none", borderRadius: "50%",
              width: 32, height: 32, cursor: "pointer", fontSize: "1.2rem",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >›</button>
        )}

        <div style={{
          position: "absolute", top: 8, right: 8,
          background: "rgba(0,0,0,0.55)", color: "#fff",
          fontSize: "0.75rem", padding: "0.15rem 0.45rem", borderRadius: 10,
        }}>
          {index + 1} / {urls.length}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 5, marginTop: "0.4rem" }}>
        {urls.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            style={{
              width: i === index ? 18 : 6, height: 6, borderRadius: 3,
              border: "none", padding: 0, cursor: "pointer",
              background: i === index ? "#333" : "#bbb",
              transition: "width 0.15s ease",
            }}
          />
        ))}
      </div>
    </div>
  );
}
