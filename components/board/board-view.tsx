"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Pill, toast } from "@/components/ui";
import { moveCard } from "@/app/(app)/board/actions";
import type { BoardCard, BoardColumn } from "@/lib/lifecycle/board";
import { STAGES, type Stage } from "@/lib/lifecycle/stage";

const DAY_MS = 24 * 60 * 60 * 1000;
const STAGE_NAMES = STAGES.map((s) => [s.id, s.name] as const);

function dueLabel(dueAt: number, nowMs: number): string {
  if (dueAt <= nowMs) return "due now";
  return `due in ${Math.ceil((dueAt - nowMs) / DAY_MS)}d`;
}

const MOVED: Record<Stage, string> = {
  todo: "Moved to Not started.",
  attempting: "Moved to Attempting.",
  revisit: "Moved to Revisit.",
  solved: "Moved to Solved.",
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
    startTransition(async () => {
      try {
        await moveCard(card.problemId, to);
        router.refresh();
        toast(MOVED[to], { kind: "success" });
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
          Opening a problem moves it to Attempting. Drag any card to any
          column; it stays there until you submit that problem again.
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
          // While a card is in the air, mark the column it would land in.
          const target =
            dragging != null && over === col.id && col.id !== dragging.stage;
          return (
            <section
              key={col.id}
              aria-labelledby={`board-col-${col.id}`}
              className="col"
              onDragOver={(e) => {
                if (!dragging) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
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
                borderColor: target ? "var(--accent)" : "var(--border)",
                boxShadow: target ? "0 0 0 3px var(--accent-ring)" : "none",
                borderRadius: 12,
                transition: "border-color 120ms, box-shadow 120ms",
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
                  {target ? "Drop here." : "Nothing here yet."}
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
  // Every move without a mouse (and on touch screens, where dragging
  // doesn't work): pick the column from a menu.
  const others = STAGE_NAMES.filter(([id]) => id !== card.stage);
  return (
    <li
      className="col"
      draggable={!pending}
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
        cursor: "grab",
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
      <select
        className="input"
        aria-label={`Move ${card.title} to another column`}
        disabled={pending}
        value=""
        onChange={(e) => {
          if (e.target.value) onMove(card, e.target.value as Stage);
        }}
        style={{ alignSelf: "flex-start", height: 26, fontSize: 12, padding: "0 6px" }}
      >
        <option value="">Move to…</option>
        {others.map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
    </li>
  );
}
