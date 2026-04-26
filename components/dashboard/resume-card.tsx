"use client";

import { useRouter } from "next/navigation";
import { Button, Icon, Pill } from "@/components/ui";

export type ResumeCardProps = {
  slug?: string;
  name?: string;
  difficulty?: "Easy" | "Medium" | "Hard";
  patternName?: string;
  elapsed?: string;
  lastEditAgo?: string;
};

export function ResumeCard({
  slug,
  name,
  difficulty,
  patternName,
  elapsed,
  lastEditAgo,
}: ResumeCardProps) {
  const router = useRouter();
  if (!slug || !name) return null;
  const diffKind =
    difficulty === "Easy" ? "easy" : difficulty === "Hard" ? "hard" : "med";
  return (
    <div className="glass" style={{ padding: 16, borderRadius: 12 }}>
      <div className="row" style={{ marginBottom: 10 }}>
        <span
          className="row"
          style={{ gap: 6, fontWeight: 600, fontSize: 13 }}
        >
          <Icon name="clock" size={14} /> Resume last attempt
        </span>
      </div>
      <div className="row" style={{ gap: 8, marginBottom: 6 }}>
        {difficulty && <Pill kind={diffKind}>{difficulty}</Pill>}
        {patternName && (
          <span className="muted mono" style={{ fontSize: 11 }}>
            {patternName}
          </span>
        )}
      </div>
      <div style={{ fontWeight: 500, fontSize: 14 }}>{name}</div>
      {(elapsed || lastEditAgo) && (
        <div
          className="muted"
          style={{ fontSize: 11.5, marginTop: 4, marginBottom: 12 }}
        >
          {elapsed && <>{elapsed} elapsed</>}
          {elapsed && lastEditAgo && " · "}
          {lastEditAgo && <>last edit {lastEditAgo}</>}
        </div>
      )}
      <Button
        kind="primary"
        size="sm"
        onClick={() => router.push(`/problem/${slug}`)}
        style={{ width: "100%", justifyContent: "center", marginTop: 10 }}
        icon="play"
      >
        Continue
      </Button>
    </div>
  );
}
