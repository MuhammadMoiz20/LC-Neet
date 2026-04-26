"use client";

import { IconButton } from "@/components/ui";

export type CheatsheetProps = {
  open: boolean;
  onClose: () => void;
};

const SECTIONS: { title: string; rows: [string, string][] }[] = [
  {
    title: "Navigation",
    rows: [
      ["⌘ K", "Command palette"],
      ["g d", "Dashboard"],
      ["g p", "Problems"],
      ["g i", "Interview mode"],
    ],
  },
  {
    title: "Workspace",
    rows: [
      ["⌘ ↵", "Run"],
      ["⇧⌘ ↵", "Submit"],
      ["⌘ J", "Toggle coach"],
      ["⌘ I", "Toggle analysis"],
      ["⌘ B", "Toggle prompt rail"],
      ["⌘ 1 / ⌘ 2", "Focus right panel"],
      ["F", "Focus mode"],
    ],
  },
  {
    title: "Coach",
    rows: [
      ["/hint", "Nudge without spoiling"],
      ["/explain", "Explain my approach"],
      ["/review", "Code review"],
      ["/complexity", "Time / space analysis"],
    ],
  },
];

export function Cheatsheet({ open, onClose }: CheatsheetProps) {
  if (!open) return null;
  return (
    <div
      className="anim-fade-in"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        background: "rgba(0,0,0,.32)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onMouseDown={onClose}
    >
      <div
        className="glass anim-scale-in"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 560,
          padding: 22,
          borderRadius: 14,
          boxShadow: "var(--shadow-pop)",
          background: "var(--surface-glass-strong)",
        }}
      >
        <div className="row" style={{ marginBottom: 14 }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Keyboard shortcuts</span>
          <div style={{ flex: 1 }} />
          <IconButton icon="x" onClick={onClose} title="Close" sm />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px 28px" }}>
          {SECTIONS.map((s) => (
            <div key={s.title}>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-faint)",
                  textTransform: "uppercase",
                  letterSpacing: ".08em",
                  fontWeight: 600,
                  marginBottom: 8,
                }}
              >
                {s.title}
              </div>
              {s.rows.map(([k, l]) => (
                <div
                  className="row"
                  key={k}
                  style={{ justifyContent: "space-between", padding: "5px 0", fontSize: 12.5 }}
                >
                  <span className="muted">{l}</span>
                  <span
                    className="row mono"
                    style={{ gap: 4, fontSize: 11.5, color: "var(--text-muted)" }}
                  >
                    {k}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
