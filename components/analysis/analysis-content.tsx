"use client";
import ReactMarkdown from "react-markdown";
import type { ReactNode } from "react";
import type { Analysis, AnalysisKind } from "@/lib/analysis/repo";
import { Section, type SectionTone } from "@/components/workspace/section";
import { Icon, type IconName } from "@/components/ui";

type SectionSpec = {
  kind: AnalysisKind;
  label: string;
  icon: IconName;
  tone: SectionTone;
  defaultOpen?: boolean;
  fallback?: ReactNode;
};

const SECTIONS: SectionSpec[] = [
  {
    kind: "mistake",
    label: "Correctness",
    icon: "check",
    tone: "accepted",
    fallback: (
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}>
        All tests pass. No recurring mistakes detected.
      </p>
    ),
  },
  { kind: "complexity", label: "Complexity", icon: "trend", tone: "accent" },
  { kind: "quality", label: "Style", icon: "beaker", tone: "info" },
  {
    kind: "comparison",
    label: "Diff vs. previous",
    icon: "diff",
    tone: "info",
    defaultOpen: true,
  },
  { kind: "pattern", label: "Pattern", icon: "graph", tone: "info" },
  {
    kind: "interview_debrief",
    label: "Interview debrief",
    icon: "briefcase",
    tone: "accent",
  },
];

function MdBody({ md }: { md: string }) {
  return (
    <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--text)" }}>
      <ReactMarkdown
        components={{
          code: ({ children, ...props }) => (
            <code
              className="mono"
              style={{
                background: "var(--bg-2)",
                padding: "1px 5px",
                borderRadius: 4,
                fontSize: 12,
              }}
              {...props}
            >
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre
              className="mono"
              style={{
                margin: "8px 0",
                padding: "10px 12px",
                background: "var(--bg-2)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
                overflow: "auto",
                lineHeight: 1.55,
              }}
            >
              {children}
            </pre>
          ),
          p: ({ children }) => (
            <p style={{ margin: "0 0 8px" }}>{children}</p>
          ),
          ul: ({ children }) => (
            <ul style={{ margin: 0, paddingLeft: 18 }}>{children}</ul>
          ),
          li: ({ children }) => (
            <li style={{ margin: "2px 0" }}>{children}</li>
          ),
        }}
      >
        {md}
      </ReactMarkdown>
    </div>
  );
}

function PendingBody() {
  return (
    <div
      className="row"
      style={{ gap: 8, color: "var(--text-muted)", fontSize: 12.5 }}
    >
      <span
        style={{
          width: 12,
          height: 12,
          border: "2px solid var(--accent)",
          borderTopColor: "transparent",
          borderRadius: "50%",
          animation: "spin-slow 600ms linear infinite",
        }}
      />
      Analysis in progress…
    </div>
  );
}

export function AnalysisContent({
  rows,
  showInterviewDebrief,
  nextSteps,
}: {
  rows: Analysis[];
  showInterviewDebrief: boolean;
  nextSteps?: ReactNode;
}) {
  const byKind = new Map(rows.map((r) => [r.kind, r] as const));
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      {SECTIONS.map((spec) => {
        if (spec.kind === "interview_debrief" && !showInterviewDebrief) {
          return null;
        }
        const row = byKind.get(spec.kind);
        const status = row?.status ?? "pending";
        return (
          <Section
            key={spec.kind}
            icon={spec.icon}
            tone={spec.tone}
            label={spec.label}
            defaultOpen={spec.defaultOpen ?? true}
          >
            {status === "pending" ? (
              <PendingBody />
            ) : status === "error" ? (
              <p
                className="muted"
                style={{ margin: 0, fontSize: 12.5, color: "var(--rose)" }}
              >
                Analysis failed.
              </p>
            ) : row && row.content_md.trim() ? (
              <MdBody md={row.content_md} />
            ) : (
              spec.fallback ?? (
                <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
                  Nothing to report.
                </p>
              )
            )}
          </Section>
        );
      })}
      {nextSteps && (
        <Section icon="arrow-r" tone="accent" label="Next steps" defaultOpen>
          {nextSteps}
        </Section>
      )}
    </div>
  );
}

export function AnalysisHeroPill({ verdict }: { verdict: "Accepted" | "Wrong" | "Error" | "TLE" }) {
  if (verdict === "Accepted") {
    return (
      <span className="pill pill-easy">
        <Icon name="check" size={10} /> Accepted
      </span>
    );
  }
  if (verdict === "TLE") {
    return (
      <span className="pill pill-med">
        <Icon name="clock" size={10} /> TLE
      </span>
    );
  }
  return (
    <span className="pill pill-hard">
      <Icon name="x" size={10} /> {verdict === "Error" ? "Error" : "Wrong"}
    </span>
  );
}

export const ANALYSIS_KIND_ORDER: AnalysisKind[] = [
  "quality",
  "complexity",
  "comparison",
  "pattern",
  "mistake",
  "interview_debrief",
];
