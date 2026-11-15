"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Pill, toast } from "@/components/ui";
import { moveCard } from "@/app/(app)/board/actions";
import type { BoardCard, BoardColumn } from "@/lib/lifecycle/board";
import { moveRefusal, type Stage } from "@/lib/lifecycle/stage";

const DAY_MS = 24 * 60 * 60 * 1000;

function dueLabel(dueAt: number, nowMs: number): string {
  if (dueAt <= nowMs) return "due now";
  return `due in ${Math.ceil((dueAt - nowMs) / DAY_MS)}d`;
}

const MOVED: Partial<Record<Stage, string>> = {
  revisit: "Marked. It'll be back in your queue tomorrow.",
  solved: "Moved to Solved. Next review in 6 days.",
  mastered: "Moved to Mastered.",
};

export function BoardView({
  columns,
  nowMs,
}: {
  columns: BoardColumn[];
  nowMs: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // The card being dragged, and the column it is currently over.
  const [dragging, setDragging] = useState<BoardCard | null>(null);
  const [over, setOver] = useState<Stage | null>(null);

  function move(card: BoardCard, to: Stage) {
    if (to === card.stage) return;
    const refusal = moveRefusal(card, to);
    if (refusal) {
      toast(refusal, { kind: "info" });
      return;
    }
    startTransition(async () => {
      try {
        const res = await moveCard(card.problemId, to);
        if (!res.ok) {
          toast(res.reason, { kind: "info" });
          return;
        }
        router.refresh();
        toast(MOVED[to] ?? "Moved.", { kind: "success" });
      } catch {
        toast("Couldn't move it. Try again.", { kind: "error" });
      }
    });
  }

  return (
    <main
      style={{
        flex: 1,
        minHeight: 0,
        minWidth: 0, // let the columns scroll inside the board, not the page
        display: "flex",
        flexDirection: "column",
        padding: "20px 24px 24px",
      }}
    >
      <div
        className="row"
        style={{ marginBottom: 16, alignItems: "flex-end", flexWrap: "wrap" }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "-.015em",
          }}
        >
          Board
        </h1>
        <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>
          Drag a card between Revisit, Solved and Mastered to change when it
          comes back. The first two columns follow your submissions.
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
          // Contain the visually-hidden count labels, which are absolutely
          // positioned and would otherwise widen the page.
          position: "relative",
        }}
      >
        {columns.map((col) => {
          // While a card is in the air, show where it may land.
          const allowed =
            dragging != null &&
            col.id !== dragging.stage &&
            moveRefusal(dragging, col.id) === null;
          const isOver = over === col.id && dragging != null;
          return (
            <section
              key={col.id}
              aria-labelledby={`board-col-${col.id}`}
              className="col"
              onDragOver={(e) => {
                if (!dragging) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = allowed ? "move" : "none";
                if (over !== col.id) setOver(col.id);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null))
                  setOver(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragging) move(dragging, col.id);
                setDragging(null);
                setOver(null);
              }}
              style={{
                flex: "1 0 250px",
                minHeight: 0,
                // Sits between the page and the cards in both themes.
                background: "color-mix(in srgb, var(--bg-2) 60%, var(--bg))",
                border: "1px solid",
                borderColor: allowed ? "var(--accent-ring)" : "var(--border)",
                boxShadow:
                  allowed && isOver ? "0 0 0 3px var(--accent-ring)" : "none",
                borderRadius: 12,
                opacity: dragging && !allowed && col.id !== dragging.stage ? 0.55 : 1,
                transition: "opacity 120ms, border-color 120ms, box-shadow 120ms",
              }}
            >
              <div
                style={{
                  padding: "12px 12px 10px",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div className="row">
                  <h2
                    id={`board-col-${col.id}`}
                    style={{ margin: 0, fontSize: 13, fontWeight: 600 }}
                  >
                    {col.name}
                  </h2>
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
                  style={{ margin: 0, padding: 12, fontSize: 12, flex: 1 }}
                >
                  {allowed ? "Drop here." : "Nothing here yet."}
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
                      lifted={dragging?.problemId === card.problemId}
                      onMove={move}
                      onDragStart={() => setDragging(card)}
                      onDragEnd={() => {
                        // A refused column shows the "no drop" cursor, so the
                        // browser never fires drop there. Say why here instead.
                        const refusal =
                          over && over !== card.stage
                            ? moveRefusal(card, over)
                            : null;
                        if (refusal) toast(refusal, { kind: "info" });
                        setDragging(null);
                        setOver(null);
                      }}
                    />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}

function Card({
  card,
  nowMs,
  pending,
  lifted,
  onMove,
  onDragStart,
  onDragEnd,
}: {
  card: BoardCard;
  nowMs: number;
  pending: boolean;
  lifted: boolean;
  onMove: (card: BoardCard, to: Stage) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  // Not-started cards have nowhere to go, so they don't pretend to be draggable.
  const movable = card.attempted;
  // The same moves without a mouse: flag it, or take a flag back.
  const button: { to: Stage; label: string } | null =
    card.stage === "revisit"
      ? card.solved
        ? { to: "solved", label: "Back to Solved" }
        : null
      : movable
        ? { to: "revisit", label: "Revisit soon" }
        : null;
  return (
    <li
      className="col"
      draggable={movable && !pending}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", card.title);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      style={{
        gap: 8,
        padding: 10,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        fontSize: 13,
        cursor: movable ? "grab" : "default",
        opacity: lifted ? 0.4 : 1,
      }}
    >
      <Link
        href={`/problem/${card.slug}`}
        className="lnk"
        draggable={false}
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
      {button && (
        <Button
          size="sm"
          disabled={pending}
          aria-label={`${button.label}: ${card.title}`}
          onClick={() => onMove(card, button.to)}
          style={{ alignSelf: "flex-start", opacity: pending ? 0.6 : 1 }}
        >
          {button.label}
        </Button>
      )}
    </li>
  );
}
