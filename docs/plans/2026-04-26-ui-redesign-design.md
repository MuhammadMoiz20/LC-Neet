# LC-Neet UI Redesign — Design

Date: 2026-04-26
Status: Approved (brainstorm)
Next: implementation plan via writing-plans skill, then frontend-design.

## Direction
Premium-playful productivity app in the Raycast/Arc lineage. Dual-theme (light + dark) on a neutral zinc base with a single **teal accent**. Soft glass surfaces, generous whitespace, **Geist Sans + Geist Mono**, springy 200–300ms motion (Framer spring). Command-palette-first.

## Information architecture
- `/` — Hybrid split dashboard. Replaces the current `/stats`. Left rail of NeetCode pattern groups w/ progress rings; main = "Do next" smart queue + GitHub-style streak heatmap + recent-analyses carousel + weak-pattern callouts.
- `/problems` — kept as a filterable table (pattern / difficulty / status facets) for power browsing.
- `/problem/[slug]` — IDE-style problem workspace (centerpiece, see below).
- `/analysis/[attemptId]` — full-page analysis (deep-link target). Same content rendered inline as a slide-in panel from the workspace.
- `/interview` — focus-mode entry; opens the workspace in interview chrome (timer, hidden results, locked coach mode).
- Global ⌘K palette + leader keys everywhere.
- `/stats` is folded into `/`.

## Problem workspace (centerpiece)
Three resizable columns, glass-on-zinc:

1. **Prompt rail (left, collapsible)** — problem statement, examples, constraints, pattern tag, difficulty pill.
2. **Editor center** — IDE chrome:
   - Tabs: **Solution / Tests / Notes / Scratch**.
   - Breadcrumb: Pattern › Problem.
   - Top-right toolbar: language picker, Reset, Run, Submit.
   - Persistent **bottom Run panel**: stdout, verdict pill, runtime/memory.
   - Shortcuts: ⌘↵ run, ⇧⌘↵ submit.
3. **Right panels (stacked side-by-side when both open)**:
   - **Coach panel** — always available, including after submission. Floating glass thread, mode pills (Hints / Socratic / Style / Interview), streaming markdown + code blocks, slash menu (`/hint`, `/explain`, `/review`, `/complexity`), resizable.
   - **Analysis panel** — pulsing **Analysis** button appears on successful submit; opening it slides the panel in to the *left* of the coach, pushing the editor narrower. Sections: Correctness, Complexity, Style, Next steps. Diff vs. previous attempt. History dropdown for past analyses on the same problem.

## Command palette & shortcuts
- ⌘K opens centered glass palette with sections:
  - **Navigate**: problems, dashboard, interview, analysis.
  - **Actions**: toggle theme, toggle coach, toggle analysis, sign out.
  - **AI**: Explain my last submission · Give me a hint · Quiz me on `<pattern>` · What should I do next? · Review my code.
- AI verbs route to coach with prefilled context (current problem, last run output, last attempt diff).
- Leader keys: `g d` dashboard, `g p` problems, `g i` interview.
- Direct: ⌘J coach, ⌘I analysis, ⌘B sidebar, ⌘1/⌘2 switch right-panel focus, `F` focus mode, `?` cheatsheet overlay.

## Dashboard (`/`)
- **Left rail (240px)** — NeetCode 150 pattern groups (Arrays & Hashing, Two Pointers, Sliding Window, …) with a progress ring per group (solved/total). Active group highlights teal.
- **Main**:
  1. **Hero "Do next"** — large card with one recommended problem (weak-pattern + spaced-repetition signal), big Start button, secondary "Skip" / "Why this?".
  2. **Activity heatmap** — GitHub-style 26-week grid, teal scale, hover tooltip with attempt count + verdicts.
  3. **Recent analyses** — horizontally scrollable cards (problem · verdict pill · runtime sparkline · 1-line coach takeaway · "Open analysis" link).
- **Right rail (collapsible)** — streak counter (big number), weak-pattern callouts (top 3 by failure rate), "Resume last attempt" if any.

## Visual system / design tokens
- **Base**: zinc-50 (light) / zinc-950 (dark).
- **Surfaces**: white / zinc-900 with 1px zinc-200 / zinc-800 borders.
- **Glass**: `backdrop-blur-xl` + 70% surface opacity + subtle inner highlight (1px top inset, 8% white in dark / 8% black in light).
- **Accent**: teal-500 primary, teal-400 hover, teal-600 active. Single accent across CTAs, active states, progress rings, heatmap scale, streak counter.
- **Semantic**: emerald (accepted), rose (wrong answer), amber (TLE/warning), sky (info).
- **Typography**: Geist Sans (UI), Geist Mono (code, big numbers, verdict pills, kbd).
- **Radius**: 12px panels, 8px buttons/inputs, 20px hero cards.
- **Shadow**: soft `0 8px 32px rgba(0,0,0,0.12)` on floating glass.
- **Motion**: Framer spring (stiffness 300, damping 30) for panel slides; 150ms opacity for hovers; gradient shimmer on streak ring + submission-success pulse on Analysis button.

## Theming
CSS-variable driven: `--bg`, `--surface`, `--surface-glass`, `--border`, `--text`, `--text-muted`, `--accent`, `--accent-hover`, plus semantic tokens. Theme toggle in palette + persists to `localStorage` + respects `prefers-color-scheme` on first visit.

## Components
**New / replaced:**
- `AppShell` (left rail + topbar + main + right-panel stack)
- `CommandPalette`
- `CoachPanel` (rewrite — glass, mode pills, slash menu, streaming markdown)
- `AnalysisPanel` (sections, diff, history dropdown)
- `WorkspaceTabs` (Solution / Tests / Notes / Scratch)
- `RunPanel` (bottom dock)
- `PatternRail`, `DoNextHero`, `Heatmap`, `RecentAnalysesCarousel`, `WeakPatternCallouts`, `StreakRing`

**Primitives:** `GlassPanel`, `Pill`, `Button`, `IconButton`, `Kbd`, `Tooltip`, `Toast`, `Dialog`.

## Out of scope
- Backend changes to coach / analysis APIs.
- New problems or pattern data.
- Mobile-first layout (target ≥1024px; degrade gracefully but don't redesign for phones).
