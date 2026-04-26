"use client";

import { useRouter } from "next/navigation";
import { Button, Icon } from "@/components/ui";

export type WeakPatternItem = {
  pattern: string;
  label: string;
  failRate: number;
  hint: string;
};

export type WeakPatternCalloutsProps = {
  items: WeakPatternItem[];
};

export function WeakPatternCallouts({ items }: WeakPatternCalloutsProps) {
  const router = useRouter();
  return (
    <div className="glass" style={{ padding: 16, borderRadius: 12 }}>
      <div className="row" style={{ marginBottom: 10 }}>
        <span
          className="row"
          style={{ gap: 6, fontWeight: 600, fontSize: 13 }}
        >
          <Icon name="target" size={14} /> Weak patterns
        </span>
        <span
          className="muted mono"
          style={{ marginLeft: "auto", fontSize: 10.5 }}
        >
          top 3
        </span>
      </div>
      <div className="col" style={{ gap: 10 }}>
        {items.map((w) => (
          <div key={w.pattern} className="col" style={{ gap: 6 }}>
            <div className="row">
              <span style={{ fontSize: 13, fontWeight: 500 }}>{w.label}</span>
              <span
                className="mono muted"
                style={{ marginLeft: "auto", fontSize: 11 }}
              >
                {Math.round(w.failRate * 100)}% fail
              </span>
            </div>
            <div
              style={{
                height: 4,
                background: "var(--bg-2)",
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.max(4, w.failRate * 100)}%`,
                  background:
                    "linear-gradient(90deg, var(--rose), var(--amber))",
                }}
              />
            </div>
            <span className="muted" style={{ fontSize: 11.5 }}>
              {w.hint}
            </span>
          </div>
        ))}
      </div>
      <Button
        size="sm"
        onClick={() => router.push("/problems")}
        style={{ marginTop: 12, width: "100%", justifyContent: "center" }}
      >
        Drill these <Icon name="arrow-r" size={12} />
      </Button>
    </div>
  );
}
