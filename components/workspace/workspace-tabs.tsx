"use client";
import { Icon, type IconName } from "@/components/ui";

export type WorkspaceTabId =
  | "sol"
  | "tests"
  | "submissions"
  | "notes"
  | "scratch";

const TABS: { id: WorkspaceTabId; name: string; icon: IconName }[] = [
  { id: "sol", name: "Solution", icon: "list" },
  { id: "tests", name: "Tests", icon: "beaker" },
  { id: "submissions", name: "Submissions", icon: "history" },
  { id: "notes", name: "Notes", icon: "note" },
  { id: "scratch", name: "Scratch", icon: "scratch" },
];

export function WorkspaceTabs({
  tab,
  onTab,
}: {
  tab: WorkspaceTabId;
  onTab: (id: WorkspaceTabId) => void;
}) {
  return (
    <div
      className="row"
      style={{
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-2)",
        height: 36,
        gap: 0,
      }}
    >
      {TABS.map((t) => (
        <button
          key={t.id}
          className={`tab ${tab === t.id ? "active" : ""}`}
          onClick={() => onTab(t.id)}
          type="button"
        >
          <Icon name={t.icon} size={13} /> {t.name}
        </button>
      ))}
      <div style={{ flex: 1 }} />
      <span
        className="row mono"
        style={{
          fontSize: 11,
          color: "var(--text-faint)",
          padding: "0 12px",
          gap: 6,
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "var(--accepted)",
          }}
        />
        autosaved
      </span>
    </div>
  );
}
