"use client";
import { useEffect, useRef, useState } from "react";
import { Icon, Kbd, Pill } from "@/components/ui";
import type { CustomResult, RunResult } from "@/lib/pyodide/worker-protocol";

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
    }
    if (c.stdout) {
      for (const s of c.stdout.replace(/\n$/, "").split("\n")) {
        lines.push({ kind: "info", text: `   ${s}` });
      }
    }
    if (!c.passed) {
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
  customInputDefault,
  customResult,
  customRunning,
  onRunCustom,
}: {
  output: OutputLine[];
  verdict: Verdict;
  runtimeMs: number | null;
  running: boolean;
  onClear: () => void;
  hideStats?: boolean;
  customInputDefault?: string;
  customResult?: CustomResult | null;
  customRunning?: boolean;
  onRunCustom?: (inputJson: string) => void;
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
      {onRunCustom && (
        <CustomInputSection
          defaultValue={customInputDefault ?? ""}
          running={!!customRunning}
          result={customResult ?? null}
          onRun={onRunCustom}
        />
      )}
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

function CustomInputSection({
  defaultValue,
  running,
  result,
  onRun,
}: {
  defaultValue: string;
  running: boolean;
  result: CustomResult | null;
  onRun: (inputJson: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(defaultValue);
  const [parseError, setParseError] = useState<string | null>(null);
  const lastDefaultRef = useRef(defaultValue);
  useEffect(() => {
    if (defaultValue !== lastDefaultRef.current) {
      setText(defaultValue);
      setParseError(null);
      lastDefaultRef.current = defaultValue;
    }
  }, [defaultValue]);

  const handleRun = () => {
    try {
      JSON.parse(text);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "invalid JSON");
      return;
    }
    setParseError(null);
    onRun(text);
  };

  return (
    <div style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-2)" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="row"
        style={{
          width: "100%",
          padding: "6px 12px",
          gap: 8,
          fontSize: 11,
          color: "var(--text-faint)",
          textTransform: "uppercase",
          letterSpacing: ".08em",
          fontWeight: 600,
          background: "transparent",
          border: 0,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <Icon name={open ? "chevron-d" : "chevron-r"} size={10} />
        Custom input
      </button>
      {open && (
        <div style={{ padding: "8px 12px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            className="mono"
            style={{
              width: "100%",
              minHeight: 70,
              fontSize: 12.5,
              padding: 8,
              background: "var(--surface)",
              color: "var(--text)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              resize: "vertical",
            }}
          />
          {parseError && (
            <div className="mono" style={{ color: "var(--rose)", fontSize: 12 }}>
              JSON parse error: {parseError}
            </div>
          )}
          <div className="row" style={{ gap: 8 }}>
            <button
              type="button"
              onClick={handleRun}
              disabled={running}
              className="btn btn-sm"
            >
              {running ? "Running…" : "Run custom"}
            </button>
            <span className="muted mono" style={{ fontSize: 11 }}>
              JSON kwargs, e.g. {`{"nums":[2,7,11,15],"target":9}`}
            </span>
          </div>
          {result && (
            <div className="mono" style={{ fontSize: 12.5, lineHeight: 1.6, marginTop: 4 }}>
              {result.compile_error && (
                <div style={{ color: "var(--rose)", whiteSpace: "pre-wrap" }}>
                  {result.compile_error}
                </div>
              )}
              {result.stdout && (
                <>
                  <div className="muted">Stdout:</div>
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{result.stdout}</pre>
                </>
              )}
              {!result.compile_error && (
                <>
                  <div className="muted">Output:</div>
                  <div>{JSON.stringify(result.actual)}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{result.elapsed_ms}ms</div>
                </>
              )}
              {result.error && (
                <div style={{ color: "var(--rose)", whiteSpace: "pre-wrap" }}>
                  {result.error}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
