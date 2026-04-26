import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <Link
        href="/problems"
        className="px-4 py-2 rounded bg-white text-black font-medium"
      >
        Browse Problems →
      </Link>
    </main>
  );
}
