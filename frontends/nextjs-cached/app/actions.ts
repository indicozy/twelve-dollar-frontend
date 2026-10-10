"use server";

import { updateTag } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createPost, likePost, tags } from "@/lib/api";
import { currentToken, NAME_COOKIE, signToken, TOKEN_COOKIE } from "@/lib/session";

export type ComposeState = { error: string | null };

// Server actions use updateTag: read-your-own-writes, the next render waits for fresh data.

export async function createPostAction(_prev: ComposeState, form: FormData): Promise<ComposeState> {
  const token = await currentToken();
  if (!token) redirect("/login");
  const { status, data } = await createPost(`Bearer ${token}`, String(form.get("body") ?? ""));
  if (status !== 201) return { error: data.error ?? `error ${status}` };
  updateTag(tags.feed);
  return { error: null };
}

export async function likeAction(form: FormData) {
  const token = await currentToken();
  if (!token) redirect("/login");
  const id = String(form.get("id"));
  const { status } = await likePost(`Bearer ${token}`, id);
  // A repeat like (200) changes nothing, so only a new like (201) invalidates the post (and the feed via its tag).
  if (status === 201) updateTag(tags.post(id));
}

export async function loginAction(form: FormData) {
  const id = Number(form.get("user_id"));
  const username = String(form.get("username") ?? "").trim();
  if (!Number.isInteger(id) || id < 1 || !username) redirect("/login?error=1");
  const jar = await cookies();
  jar.set(TOKEN_COOKIE, signToken(id, username), { httpOnly: true, sameSite: "lax", path: "/" });
  jar.set(NAME_COOKIE, encodeURIComponent(username), { sameSite: "lax", path: "/" });
  redirect("/");
}
