"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ToastHost, toast } from "@/components/ui";
import { TopBar } from "./top-bar";
import { CommandPalette, type PaletteProblem } from "./command-palette";
import { Cheatsheet } from "./cheatsheet";

export type AppShellProps = {
  children: ReactNode;
  problems: PaletteProblem[];
  avatarInitials?: string;
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

export function AppShell({ children, problems, avatarInitials = "?" }: AppShellProps) {
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false);
  const leaderRef = useRef<{ time: number } | null>(null);

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);
  const openCheatsheet = useCallback(() => setCheatsheetOpen(true), []);
  const closeCheatsheet = useCallback(() => setCheatsheetOpen(false), []);

  // The panels belong to the problem workspace. Ask it with a cancelable
  // event: it cancels the event when it toggles, so an un-cancelled event
  // means there was no panel to toggle on this page.
  const onToggleCoach = useCallback(() => {
    if (window.dispatchEvent(new Event("lcn:toggle-coach", { cancelable: true }))) {
      toast("Open a problem to use the coach", { kind: "info" });
    }
  }, []);
  const onToggleAnalysis = useCallback(() => {
    if (window.dispatchEvent(new Event("lcn:toggle-analysis", { cancelable: true }))) {
      toast("Submit an accepted solution to see its analysis", { kind: "info" });
    }
  }, []);

  // Tell the server the browser's UTC offset so "today", streaks and the
  // heatmap follow the user's clock (see lib/time/local-day.ts).
  useEffect(() => {
    document.cookie = `tz=${-new Date().getTimezoneOffset()}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        e.stopPropagation(); // Monaco treats ⌘K as a chord prefix
        setPaletteOpen((v) => !v);
        return;
      }
      const typing = isTypingTarget(e.target);
      if (typing) return;

      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setCheatsheetOpen((v) => !v);
        return;
      }

      // Leader sequence: g then d|p|b|i within 900ms
      if (e.key === "g") {
        leaderRef.current = { time: Date.now() };
        return;
      }
      const leader = leaderRef.current;
      if (leader && Date.now() - leader.time < 900) {
        if (e.key === "d") {
          e.preventDefault();
          leaderRef.current = null;
          router.push("/");
          return;
        }
        if (e.key === "p") {
          e.preventDefault();
          leaderRef.current = null;
          router.push("/problems");
          return;
        }
        if (e.key === "b") {
          e.preventDefault();
          leaderRef.current = null;
          router.push("/board");
          return;
        }
        if (e.key === "i") {
          e.preventDefault();
          leaderRef.current = null;
          router.push("/interview");
          return;
        }
        leaderRef.current = null;
      }
    }
    // Capture phase, so ⌘K also works while the cursor is in the code editor.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [router]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <TopBar
        onOpenPalette={openPalette}
        onOpenCheatsheet={openCheatsheet}
        avatarInitials={avatarInitials}
      />
      <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: "flex", position: "relative" }}>
        {children}
      </div>
      {paletteOpen && (
        <CommandPalette
          open={paletteOpen}
          onClose={closePalette}
          problems={problems}
          onToggleCoach={onToggleCoach}
          onToggleAnalysis={onToggleAnalysis}
        />
      )}
      <Cheatsheet open={cheatsheetOpen} onClose={closeCheatsheet} />
      <ToastHost />
    </div>
  );
}
