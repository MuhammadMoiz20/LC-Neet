"use client";
import ReactMarkdown from "react-markdown";
import type { Problem } from "@/lib/problems/types";
import { IconButton, Pill } from "@/components/ui";
import { topicToPatternId, getPatternName } from "@/lib/patterns/groups";

type PillKind = "easy" | "med" | "hard";
function difficultyKind(d: Problem["difficulty"]): PillKind {
  return d === "Easy" ? "easy" : d === "Hard" ? "hard" : "med";
}

export function PromptRail({
  problem,
  collapsed,
  onToggle,
}: {
  problem: Problem;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const patternId = topicToPatternId(problem.topic);
  const patternName = getPatternName(patternId);

  if (collapsed) {
    return (
      <div
        style={{
          width: 36,
          flexShrink: 0,
          borderRight: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "10px 0",
          gap: 8,
          background: "var(--surface-glass)",
        }}
      >
        <IconButton icon="panel-l" onClick={onToggle} title="Show prompt (⌘B)" sm />
        <div
          style={{
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
            fontSize: 11,
            color: "var(--text-muted)",
            marginTop: 8,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          {problem.title}
        </div>
      </div>
    );
  }

  return (
    <aside
      style={{
        width: 340,
        flexShrink: 0,
        borderRight: "1px solid var(--border)",
        overflowY: "auto",
        background: "var(--surface-glass)",
      }}
    >
      <div
        className="row"
        style={{
          padding: "10px 14px",
          borderBottom: "1px solid var(--border)",
          position: "sticky",
          top: 0,
          background: "var(--surface-glass-strong)",
          backdropFilter: "blur(20px)",
          zIndex: 1,
        }}
      >
        <span
          className="row mono"
          style={{ gap: 6, fontSize: 11.5, color: "var(--text-muted)" }}
        >
          {patternName}{" "}
          <span style={{ color: "var(--text-faint)" }}>›</span>{" "}
          <span style={{ color: "var(--text)" }}>{problem.title}</span>
        </span>
        <div style={{ flex: 1 }} />
        <IconButton icon="panel-l" sm onClick={onToggle} title="Hide prompt (⌘B)" />
      </div>
      <div style={{ padding: "18px 18px 24px" }}>
        <div className="row" style={{ gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
          <Pill kind={difficultyKind(problem.difficulty)}>{problem.difficulty}</Pill>
          <Pill>{problem.topic}</Pill>
        </div>
        <h1
          style={{
            margin: "0 0 14px",
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "-.015em",
          }}
        >
          {problem.id}. {problem.title}
        </h1>
        <div
          style={{
            fontSize: 13.5,
            color: "var(--text)",
            lineHeight: 1.6,
          }}
          className="prompt-md"
        >
          <ReactMarkdown
            components={{
              code: ({ children, ...props }) => (
                <code
                  className="mono"
                  style={{
                    background: "var(--bg-2)",
                    padding: "1px 5px",
                    borderRadius: 4,
                    fontSize: 12.5,
                  }}
                  {...props}
                >
                  {children}
                </code>
              ),
              p: ({ children }) => (
                <p style={{ margin: "0 0 12px" }}>{children}</p>
              ),
              ul: ({ children }) => (
                <ul style={{ paddingLeft: 18, margin: "0 0 12px" }}>{children}</ul>
              ),
              li: ({ children }) => (
                <li style={{ margin: "2px 0" }}>{children}</li>
              ),
              pre: ({ children }) => (
                <pre
                  className="mono"
                  style={{
                    background: "var(--bg-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "8px 10px",
                    fontSize: 12,
                    overflow: "auto",
                  }}
                >
                  {children}
                </pre>
              ),
            }}
          >
            {problem.description_md}
          </ReactMarkdown>
        </div>
      </div>
    </aside>
  );
}
