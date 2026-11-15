/** The lc-neet mark and wordmark, shared by the top bar and the sign-in page. */
export function BrandMark() {
  return (
    <span
      className="row"
      style={{ gap: 8, color: "var(--text)", flexShrink: 0, whiteSpace: "nowrap" }}
    >
      <span
        style={{
          width: 24,
          height: 24,
          flexShrink: 0,
          borderRadius: 7,
          background: "linear-gradient(135deg, var(--accent), var(--accent-active))",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow:
            "0 1px 0 rgba(255,255,255,.3) inset, 0 2px 8px rgba(20,184,166,.35)",
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 7l5 5-5 5M13 17h6" />
        </svg>
      </span>
      <span
        className="mono"
        style={{ fontWeight: 600, letterSpacing: "-.01em", fontSize: 13 }}
      >
        lc-neet
      </span>
    </span>
  );
}
