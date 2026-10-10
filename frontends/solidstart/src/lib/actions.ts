import { action, redirect } from "@solidjs/router";
import { setCookie } from "@solidjs/start/http";
import { createPost, likePost } from "./api";
import { currentToken, signToken, TOKEN_COOKIE } from "./session";

// Form actions (server functions). After one runs, the router revalidates the page's queries (with JS),
// or the no-JS form post is redirected back to the page, which renders fresh data.

export const createPostAction = action(async (form: FormData): Promise<{ error: string | null }> => {
  "use server";
  const token = currentToken();
  if (!token) throw redirect("/login");
  const { status, data } = await createPost(`Bearer ${token}`, String(form.get("body") ?? ""));
  if (status !== 201) return { error: data.error ?? `error ${status}` };
  return { error: null };
}, "createPost");

export const likeAction = action(async (form: FormData) => {
  "use server";
  const token = currentToken();
  if (!token) throw redirect("/login");
  await likePost(`Bearer ${token}`, String(form.get("id")));
}, "like");

export const loginAction = action(async (form: FormData) => {
  "use server";
  const id = Number(form.get("user_id"));
  const username = String(form.get("username") ?? "").trim();
  if (!Number.isInteger(id) || id < 1 || !username) throw redirect("/login?error=1");
  setCookie(TOKEN_COOKIE, signToken(id, username), { httpOnly: true, sameSite: "lax", path: "/" });
  throw redirect("/");
}, "login");
