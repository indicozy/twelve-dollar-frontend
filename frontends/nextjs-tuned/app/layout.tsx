import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { currentUsername } from "@/lib/session";
import "./globals.css";

export const metadata: Metadata = {
  title: "Feed · Next.js",
  description: "SSR benchmark app: Next.js frontend over a Rust + SQLite feed API",
};

async function Who() {
  const name = await currentUsername();
  return name ? <span className="who">@{name}</span> : <Link href="/login">Sign in</Link>;
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <header className="top">
          <Link href="/" className="brand">
            feed<span>.</span>
          </Link>
          <span className="stack">next.js</span>
          <nav>
            <Suspense fallback={null}>
              <Who />
            </Suspense>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
