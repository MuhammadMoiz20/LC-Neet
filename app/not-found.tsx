import Link from "next/link";
import { BrandMark } from "@/components/app-shell/brand-mark";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div
        className="glass col"
        style={{ width: "100%", maxWidth: 360, padding: 28, borderRadius: 16, gap: 10 }}
      >
        <BrandMark />
        <h1 style={{ margin: "6px 0 0", fontSize: 20, fontWeight: 600 }}>
          That page doesn&apos;t exist
        </h1>
        <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}>
          The address may be mistyped, or the problem or attempt it pointed to is gone.
        </p>
        <Link
          href="/"
          className="btn btn-primary btn-lg"
          style={{ justifyContent: "center", marginTop: 6, textDecoration: "none" }}
        >
          Go to the dashboard
        </Link>
      </div>
    </main>
  );
}
