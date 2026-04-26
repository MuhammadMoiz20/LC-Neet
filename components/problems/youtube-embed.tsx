"use client";

export function extractYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.searchParams.get("v");
  } catch {
    return null;
  }
}

export function YouTubeEmbed({ url }: { url: string | null | undefined }) {
  const id = extractYouTubeId(url);
  if (!id) return null;
  return (
    <details
      style={{
        marginTop: 18,
        border: "1px solid var(--border)",
        borderRadius: 8,
        background: "var(--surface-glass)",
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          padding: "10px 12px",
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: ".04em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
        }}
      >
        Walkthrough · NeetCode
      </summary>
      <div
        style={{
          aspectRatio: "16 / 9",
          width: "100%",
          overflow: "hidden",
          borderTop: "1px solid var(--border)",
        }}
      >
        <iframe
          style={{ width: "100%", height: "100%", border: 0 }}
          src={`https://www.youtube-nocookie.com/embed/${id}`}
          title="NeetCode walkthrough"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </details>
  );
}
