"use client";
import { useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui";

export type SectionTone = "accepted" | "accent" | "info" | "muted";

export function Section({
  icon,
  tone = "muted",
  label,
  defaultOpen = true,
  children,
}: {
  icon: IconName;
  tone?: SectionTone;
  label: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const toneColor =
    tone === "accepted"
      ? "var(--accepted)"
      : tone === "accent"
        ? "var(--accent)"
        : tone === "info"
          ? "var(--sky)"
          : "var(--text-muted)";
  return (
    <div className="col" style={{ gap: 8 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="row"
        style={{
          border: 0,
          background: "transparent",
          padding: 0,
          color: "var(--text)",
          cursor: "pointer",
          gap: 8,
        }}
      >
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: "var(--bg-2)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: toneColor,
          }}
        >
          <Icon name={icon} size={12} />
        </span>
        <span
          style={{
            fontSize: 12,
            letterSpacing: ".04em",
            textTransform: "uppercase",
            fontWeight: 600,
            color: "var(--text-muted)",
          }}
        >
          {label}
        </span>
        <div style={{ flex: 1 }} />
        <span
          className="muted"
          style={{
            display: "inline-flex",
            transform: open ? "" : "rotate(-90deg)",
            transition: "transform 200ms",
          }}
        >
          <Icon name="chevron-d" size={12} />
        </span>
      </button>
      {open && <div style={{ paddingLeft: 30 }}>{children}</div>}
    </div>
  );
}
