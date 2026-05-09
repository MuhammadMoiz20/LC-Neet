"use client";
import ReactMarkdown from "react-markdown";
import type { CSSProperties, ReactNode } from "react";
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
    kind: "grade",
    label: "Smart grade",
    icon: "spark",
    tone: "accent",
    defaultOpen: true,
  },
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

type ParsedComplexity = {
  body: string;
  submitted: { time: string; space: string };
  optimal: { time: string; space: string };
};

function parseComplexity(md: string): ParsedComplexity | null {
  const re =
    /^([\s\S]*?)\n+Final:\s*O\(([^)]+)\)\s*time,\s*O\(([^)]+)\)\s*space\s*\n+Optimal:\s*O\(([^)]+)\)\s*time,\s*O\(([^)]+)\)\s*space\s*$/;
  const m = md.trim().match(re);
  if (!m) return null;
  return {
    body: m[1].trim(),
    submitted: { time: m[2].trim(), space: m[3].trim() },
    optimal: { time: m[4].trim(), space: m[5].trim() },
  };
}

function ComplexityCompare({
  submitted,
  optimal,
}: Omit<ParsedComplexity, "body">) {
  const timeMatch = submitted.time === optimal.time;
  const spaceMatch = submitted.space === optimal.space;
  const allMatch = timeMatch && spaceMatch;
  const labelStyle: CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  };
  const rowLabel: CSSProperties = {
    fontSize: 12,
    color: "var(--text-muted)",
  };
  const cellBase: CSSProperties = {
    fontSize: 13,
    padding: "2px 8px",
    borderRadius: 4,
    background: "var(--bg-2)",
    display: "inline-block",
  };
  const submittedCell = (matches: boolean): CSSProperties => ({
    ...cellBase,
    color: matches ? "var(--text)" : "var(--rose)",
    border: matches ? "1px solid var(--border)" : "1px solid var(--rose)",
  });
  const optimalCell: CSSProperties = {
    ...cellBase,
    color: "var(--accent)",
    border: "1px solid var(--accent)",
  };
  return (
    <div
      style={{
        marginTop: 12,
        padding: "10px 12px",
        background: "var(--bg-1)",
        border: "1px solid var(--border)",
        borderRadius: 8,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr 1fr",
          rowGap: 6,
          columnGap: 16,
          alignItems: "center",
        }}
      >
        <span />
        <span style={labelStyle}>Submitted</span>
        <span style={labelStyle}>Optimal</span>
        <span style={rowLabel}>Time</span>
        <code className="mono" style={submittedCell(timeMatch)}>
          O({submitted.time})
        </code>
        <code className="mono" style={optimalCell}>
          O({optimal.time})
        </code>
        <span style={rowLabel}>Space</span>
        <code className="mono" style={submittedCell(spaceMatch)}>
          O({submitted.space})
        </code>
        <code className="mono" style={optimalCell}>
          O({optimal.space})
        </code>
      </div>
      <p
        style={{
          margin: "10px 0 0",
          fontSize: 12,
          color: allMatch ? "var(--accent)" : "var(--text-muted)",
        }}
      >
        {allMatch
          ? "Already at the optimal bound."
          : !timeMatch && !spaceMatch
            ? "Both time and space can be tightened."
            : !timeMatch
              ? "Time can be improved."
              : "Space can be improved."}
      </p>
    </div>
  );
}

function ComplexityBody({ md }: { md: string }) {
  const parsed = parseComplexity(md);
  if (!parsed) {
    return <MdBody md={md} />;
  }
  return (
    <>
      {parsed.body && <MdBody md={parsed.body} />}
      <ComplexityCompare submitted={parsed.submitted} optimal={parsed.optimal} />
    </>
  );
}

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
              spec.kind === "complexity" ? (
                <ComplexityBody md={row.content_md} />
              ) : (
                <MdBody
                  md={
                    spec.kind === "grade"
                      ? row.content_md.replace(/^Grade:\s*\d+\s*\n?/, "").trim()
                      : row.content_md
                  }
                />
              )
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
  "grade",
  "quality",
  "complexity",
  "comparison",
  "pattern",
  "mistake",
  "interview_debrief",
];

/** Pulls "Grade: N" off the top of a grade analysis body. Returns null if not parseable. */
export function parseGrade(md: string): number | null {
  const m = md.match(/^Grade:\s*(\d{1,2})\b/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 0 || n > 10) return null;
  return n;
}
