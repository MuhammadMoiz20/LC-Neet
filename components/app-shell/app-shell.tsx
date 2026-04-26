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

  const onToggleCoach = useCallback(() => {
    /* coach panel toggle wired in T7 */
  }, []);
  const onToggleAnalysis = useCallback(() => {
    /* analysis panel toggle wired in T8 */
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
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

      // Leader sequence: g then d|p|i within 900ms
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
        if (e.key === "i") {
          e.preventDefault();
          leaderRef.current = null;
          router.push("/interview");
          return;
        }
        leaderRef.current = null;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  // Expose toast through window for legacy callers (already in ToastHost).
  // Bind ⌘J / ⌘I to coach/analysis toggle hint toasts so cheatsheet hints work.
  useEffect(() => {
    function onMeta(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      if (e.key.toLowerCase() === "j") {
        e.preventDefault();
        onToggleCoach();
        toast("Toggled coach");
      } else if (e.key.toLowerCase() === "i") {
        e.preventDefault();
        onToggleAnalysis();
        toast("Toggled analysis");
      }
    }
    window.addEventListener("keydown", onMeta);
    return () => window.removeEventListener("keydown", onMeta);
  }, [onToggleCoach, onToggleAnalysis]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <TopBar
        onOpenPalette={openPalette}
        onOpenCheatsheet={openCheatsheet}
        avatarInitials={avatarInitials}
      />
      <div style={{ flex: 1, minHeight: 0, display: "flex", position: "relative" }}>
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
