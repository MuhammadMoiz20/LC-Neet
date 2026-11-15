"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button, Pill, toast } from "@/components/ui";
import { markRevisit } from "@/app/(app)/board/actions";
import type { BoardCard, BoardColumn } from "@/lib/lifecycle/board";

const DAY_MS = 24 * 60 * 60 * 1000;

function dueLabel(dueAt: number, nowMs: number): string {
  if (dueAt <= nowMs) return "due now";
  return `due in ${Math.ceil((dueAt - nowMs) / DAY_MS)}d`;
}

export function BoardView({
  columns,
  nowMs,
}: {
  columns: BoardColumn[];
  nowMs: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onRevisit(problemId: number) {
    startTransition(async () => {
      try {
        await markRevisit(problemId);
        router.refresh();
        toast("Marked. It'll be back in your queue tomorrow.", {
          kind: "success",
        });
      } catch (e) {
        toast(e instanceof Error ? e.message : "Could not mark it", {
          kind: "error",
        });
      }
    });
  }

  return (
    <main
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        padding: "20px 24px 24px",
      }}
    >
      <div
        className="row"
        style={{ marginBottom: 16, alignItems: "flex-end", flexWrap: "wrap" }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "-.015em",
          }}
        >
          Board
        </h2>
        <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>
          Stages follow what you actually did. Nothing is dragged by hand.
        </span>
      </div>

      <div
        role="region"
        aria-label="Problem lifecycle board"
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          gap: 12,
          overflowX: "auto",
        }}
      >
        {columns.map((col) => (
          <section
            key={col.id}
            aria-labelledby={`board-col-${col.id}`}
            className="col"
            style={{
              flex: "1 0 250px",
              minHeight: 0,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 12,
            }}
          >
            <div
              style={{
                padding: "12px 12px 10px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div className="row">
                <h3
                  id={`board-col-${col.id}`}
                  style={{ margin: 0, fontSize: 13, fontWeight: 600 }}
                >
                  {col.name}
                </h3>
                <span className="mono muted" style={{ fontSize: 11.5 }}>
                  {col.cards.length}
                  <span className="sr-only"> problems</span>
                </span>
              </div>
              <p
                className="muted"
                style={{ margin: "4px 0 0", fontSize: 11.5, lineHeight: 1.4 }}
              >
                {col.blurb}
              </p>
            </div>

            {col.cards.length === 0 ? (
              <p
                className="muted"
                style={{ margin: 0, padding: 12, fontSize: 12 }}
              >
                Nothing here yet.
              </p>
            ) : (
              <ul
                className="col"
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 8,
                  gap: 8,
                  flex: 1,
                  minHeight: 0,
                  overflowY: "auto",
                }}
              >
                {col.cards.map((card) => (
                  <Card
                    key={card.problemId}
                    card={card}
                    nowMs={nowMs}
                    pending={pending}
                    onRevisit={onRevisit}
                  />
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}

function Card({
  card,
  nowMs,
  pending,
  onRevisit,
}: {
  card: BoardCard;
  nowMs: number;
  pending: boolean;
  onRevisit: (problemId: number) => void;
}) {
  const canRevisit =
    card.stage === "attempting" ||
    card.stage === "solved" ||
    card.stage === "mastered";
  return (
    <li
      className="col"
      style={{
        gap: 8,
        padding: 10,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        fontSize: 13,
      }}
    >
      <Link
        href={`/problem/${card.slug}`}
        className="lnk"
        style={{ fontWeight: 500, lineHeight: 1.35 }}
      >
        {card.title}
      </Link>
      <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
        <Pill
          kind={
            card.difficulty === "Easy"
              ? "easy"
              : card.difficulty === "Medium"
                ? "med"
                : "hard"
          }
        >
          {card.difficulty}
        </Pill>
        <span className="muted mono" style={{ fontSize: 11.5 }}>
          {card.patternName}
        </span>
      </div>
      {card.stage === "revisit" && card.dueAt != null && (
        <span className="mono muted" style={{ fontSize: 11.5 }}>
          {dueLabel(card.dueAt, nowMs)}
        </span>
      )}
      {canRevisit && (
        <Button
          size="sm"
          disabled={pending}
          aria-label={`Revisit soon: ${card.title}`}
          onClick={() => onRevisit(card.problemId)}
          style={{ alignSelf: "flex-start", opacity: pending ? 0.6 : 1 }}
        >
          Revisit soon
        </Button>
      )}
    </li>
  );
}
