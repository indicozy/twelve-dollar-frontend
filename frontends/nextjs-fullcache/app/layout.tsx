import type { Metadata } from "next";
import Link from "next/link";
import { Who } from "./who";
import "./globals.css";

export const metadata: Metadata = {
  title: "Feed · Next.js (full cache)",
  description: "SSR benchmark app: cached Next.js frontend over a Rust + SQLite feed API",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <header className="top">
          <Link href="/" className="brand">
            feed<span>.</span>
          </Link>
          <span className="stack">next.js full cache</span>
          <nav>
            <Who />
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
