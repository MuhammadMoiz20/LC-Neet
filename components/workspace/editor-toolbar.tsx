"use client";
import { Button, Icon, Kbd } from "@/components/ui";

export type EditorLang = "Python 3" | "JavaScript" | "TypeScript" | "Go" | "Rust";

export function EditorToolbar({
  onRun,
  onStop,
  onSubmit,
  onReset,
  running,
  pythonReady,
  hasAnalysis,
  analysisOpen,
  onOpenAnalysis,
  lang,
  setLang,
  hideSubmitInIv,
}: {
  onRun: () => void;
  onStop: () => void;
  onSubmit: () => void;
  onReset: () => void;
  running: boolean;
  pythonReady: boolean;
  hasAnalysis: boolean;
  analysisOpen: boolean;
  onOpenAnalysis: () => void;
  lang: EditorLang;
  setLang: (l: EditorLang) => void;
  hideSubmitInIv?: boolean;
}) {
  return (
    <div
      className="row"
      style={{
        height: 40,
        padding: "0 12px",
        borderBottom: "1px solid var(--border)",
        background: "var(--surface)",
        gap: 8,
      }}
    >
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as EditorLang)}
        className="input mono"
        style={{ height: 28, padding: "0 8px", fontSize: 12 }}
      >
        <option value="Python 3">Python 3</option>
        <option value="JavaScript" disabled>
          JavaScript (soon)
        </option>
        <option value="TypeScript" disabled>
          TypeScript (soon)
        </option>
        <option value="Go" disabled>
          Go (soon)
        </option>
        <option value="Rust" disabled>
          Rust (soon)
        </option>
      </select>
      <div style={{ flex: 1 }} />
      {hasAnalysis && (
        <button
          type="button"
          onClick={onOpenAnalysis}
          className={`btn btn-sm ${analysisOpen ? "" : "anim-pulse-accent"}`}
          style={{
            background: analysisOpen ? "var(--accent-soft)" : "var(--surface)",
            color: analysisOpen ? "var(--accent)" : "var(--text)",
            borderColor: analysisOpen ? "var(--accent-ring)" : "var(--border)",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span style={{ display: "inline-flex", color: "var(--accent)" }}>
            <Icon name="spark" size={12} />
          </span>
          Analysis ready
        </button>
      )}
      <Button size="sm" icon="reset" kind="ghost" onClick={onReset}>
        Reset
      </Button>
      {running ? (
        <Button
          size="sm"
          onClick={onStop}
          style={{
            color: "var(--rose)",
            borderColor: "var(--rose)",
          }}
        >
          Stop
        </Button>
      ) : (
        <Button
          size="sm"
          icon="play"
          onClick={onRun}
          disabled={!pythonReady}
        >
          {!pythonReady ? "Loading Python…" : "Run"} <Kbd>⌘</Kbd>
          <Kbd>↵</Kbd>
        </Button>
      )}
      {!hideSubmitInIv && (
        <Button size="sm" kind="primary" onClick={onSubmit} disabled={running || !pythonReady}>
          Submit <Kbd>⇧⌘</Kbd>
          <Kbd>↵</Kbd>
        </Button>
      )}
    </div>
  );
}
