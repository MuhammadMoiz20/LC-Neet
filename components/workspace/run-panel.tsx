"use client";
import { Icon, Kbd, Pill } from "@/components/ui";
import type { RunResult } from "@/lib/pyodide/worker-protocol";

export type Verdict = "Accepted" | "Wrong" | "TLE" | "Error" | null;

export type OutputLine = {
  kind: "info" | "pass" | "fail" | "err";
  text: string;
};

export function buildOutputLines(
  result: RunResult | null,
  interviewMode: boolean,
): OutputLine[] {
  if (!result) return [];
  if (result.compile_error) {
    if (interviewMode) {
      const first = result.compile_error.split("\n")[0] ?? "error";
      return [{ kind: "err", text: `Runtime error: ${first}` }];
    }
    return result.compile_error
      .split("\n")
      .map((t) => ({ kind: "err" as const, text: t }));
  }
  if (interviewMode) {
    return [{ kind: "info", text: "Compiled" }];
  }
  const lines: OutputLine[] = [];
  result.results.forEach((c, i) => {
    if (c.passed) {
      lines.push({
        kind: "pass",
        text: `✓ test ${i + 1} (${c.elapsed_ms}ms)`,
      });
    } else {
      lines.push({
        kind: "fail",
        text: `✗ test ${i + 1} (${c.elapsed_ms}ms)`,
      });
      lines.push({
        kind: "info",
        text: `   expected: ${JSON.stringify(c.expected)}`,
      });
      lines.push({
        kind: "info",
        text: `   actual:   ${JSON.stringify(c.actual)}`,
      });
      if (c.error) {
        lines.push({ kind: "err", text: `   ${c.error}` });
      }
    }
  });
  const passed = result.results.filter((c) => c.passed).length;
  const total = result.results.length;
  lines.push({ kind: "info", text: "" });
  lines.push({
    kind: "info",
    text: `${passed}/${total} tests passed`,
  });
  return lines;
}

export function RunPanel({
  output,
  verdict,
  runtimeMs,
  running,
  onClear,
  hideStats,
}: {
  output: OutputLine[];
  verdict: Verdict;
  runtimeMs: number | null;
  running: boolean;
  onClear: () => void;
  hideStats?: boolean;
}) {
  return (
    <div
      style={{
        height: 200,
        borderTop: "1px solid var(--border)",
        background: "var(--surface-2)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        className="row"
        style={{
          height: 32,
          padding: "0 12px",
          borderBottom: "1px solid var(--border)",
          gap: 8,
          background: "var(--bg-2)",
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: "var(--text-faint)",
            textTransform: "uppercase",
            letterSpacing: ".08em",
            fontWeight: 600,
          }}
        >
          Run
        </span>
        {!hideStats && verdict === "Accepted" && (
          <Pill kind="easy">
            <Icon name="check" size={10} /> Accepted
          </Pill>
        )}
        {!hideStats && verdict === "Wrong" && (
          <Pill kind="hard">
            <Icon name="x" size={10} /> Wrong answer
          </Pill>
        )}
        {!hideStats && verdict === "TLE" && (
          <Pill kind="med">
            <Icon name="clock" size={10} /> TLE
          </Pill>
        )}
        {!hideStats && verdict === "Error" && (
          <Pill kind="hard">
            <Icon name="x" size={10} /> Error
          </Pill>
        )}
        {hideStats && verdict && (
          <Pill kind="info">
            <Icon name="check" size={10} /> Compiled
          </Pill>
        )}
        {!verdict && !running && (
          <span className="muted mono" style={{ fontSize: 11 }}>
            idle — <Kbd>⌘</Kbd>
            <Kbd>↵</Kbd> to run
          </span>
        )}
        {running && (
          <span
            className="row"
            style={{ gap: 6, fontSize: 11, color: "var(--text-muted)" }}
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
            />{" "}
            running…
          </span>
        )}
        <div style={{ flex: 1 }} />
        {!hideStats && runtimeMs != null && (
          <span className="mono muted" style={{ fontSize: 11 }}>
            {runtimeMs}ms
          </span>
        )}
        <button
          type="button"
          onClick={onClear}
          className="btn btn-ghost btn-sm btn-icon"
          aria-label="Clear output"
          title="Clear"
        >
          <Icon name="reset" size={14} />
        </button>
      </div>
      <div
        className="mono"
        style={{
          flex: 1,
          padding: "10px 14px",
          overflow: "auto",
          fontSize: 12.5,
          lineHeight: 1.6,
          color: "var(--text)",
        }}
      >
        {output.length === 0 && (
          <span className="muted">
            No output yet. Press <Kbd>⌘</Kbd>
            <Kbd>↵</Kbd> to run against the sample tests.
          </span>
        )}
        {output.map((l, i) => (
          <div
            key={i}
            style={{
              color:
                l.kind === "err" || l.kind === "fail"
                  ? "var(--rose)"
                  : l.kind === "pass"
                    ? "var(--accepted)"
                    : "var(--text)",
              whiteSpace: "pre-wrap",
            }}
          >
            {l.text || " "}
          </div>
        ))}
      </div>
    </div>
  );
}
