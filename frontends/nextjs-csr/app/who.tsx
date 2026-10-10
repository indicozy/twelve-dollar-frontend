"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { getToken, tokenUsername } from "@/lib/api";

const subscribe = () => () => {};

export function Who() {
  const name = useSyncExternalStore(subscribe, () => tokenUsername(getToken()) ?? "", () => "");
  return name ? <span className="who">@{name}</span> : <Link href="/login">Sign in</Link>;
}
