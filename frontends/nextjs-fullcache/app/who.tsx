"use client";

// Signed-in name, read from a browser-visible cookie after hydration. Reading cookies on the server
// would make every page render per request; this keeps the whole page static.
import Link from "next/link";
import { useSyncExternalStore } from "react";

const read = () => document.cookie.match(/(?:^|; )username=([^;]*)/)?.[1] ?? "";
const subscribe = () => () => {};

export function Who() {
  const name = useSyncExternalStore(subscribe, read, () => "");
  return name ? <span className="who">@{decodeURIComponent(name)}</span> : <Link href="/login">Sign in</Link>;
}
