"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createPost, likePost } from "@/lib/api";
import { currentToken, signToken, TOKEN_COOKIE } from "@/lib/session";

export type ComposeState = { error: string | null };

export async function createPostAction(_prev: ComposeState, form: FormData): Promise<ComposeState> {
  const token = await currentToken();
  if (!token) redirect("/login");
  const { status, data } = await createPost(`Bearer ${token}`, String(form.get("body") ?? ""));
  if (status !== 201) return { error: data.error ?? `error ${status}` };
  refresh();
  return { error: null };
}

export async function likeAction(form: FormData) {
  const token = await currentToken();
  if (!token) redirect("/login");
  await likePost(`Bearer ${token}`, String(form.get("id")));
  refresh();
}

export async function loginAction(form: FormData) {
  const id = Number(form.get("user_id"));
  const username = String(form.get("username") ?? "").trim();
  if (!Number.isInteger(id) || id < 1 || !username) redirect("/login?error=1");
  (await cookies()).set(TOKEN_COOKIE, signToken(id, username), { httpOnly: true, sameSite: "lax", path: "/" });
  redirect("/");
}
