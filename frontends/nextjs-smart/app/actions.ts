"use server";

import { updateTag } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createPost, likePost, tags } from "@/lib/api";
import { currentToken, NAME_COOKIE, signToken, TOKEN_COOKIE } from "@/lib/session";

export type ComposeState = { error: string | null; posted: boolean };

// Writes don't invalidate any cache. The feed refreshes itself every 15 s, so a new post appears within ~15 s
// (no read-your-own-writes), and like counts are live in the browser, so a like changes no page.

export async function createPostAction(_prev: ComposeState, form: FormData): Promise<ComposeState> {
  const token = await currentToken();
  if (!token) redirect("/login");
  const { status, data } = await createPost(`Bearer ${token}`, String(form.get("body") ?? ""));
  if (status !== 201) return { error: data.error ?? `error ${status}`, posted: false };
  return { error: null, posted: true };
}

/** Called by the like button; returns the API status (201 = new like, 200 = repeat) or "login". */
export async function likeAction(id: number): Promise<number | "login"> {
  const token = await currentToken();
  if (!token) return "login";
  const { status } = await likePost(`Bearer ${token}`, String(id));
  return status;
}

/** The only thing that refreshes a stored post page: call it after the post's author edits it. The API has no edit
 *  endpoint yet, so nothing calls this today. */
export async function revalidatePostAfterEdit(id: number) {
  updateTag(tags.post(id));
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
