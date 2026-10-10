// Astro Actions, submitted as plain HTML forms (`<form method="POST" action={actions.like}>`, no client JS).
// Astro runs the action before rendering the page; the page then reads the result with Astro.getActionResult()
// and answers with a 303 redirect (Post/Redirect/Get), like the SvelteKit form actions and Next.js server actions.
import { ActionError, defineAction } from "astro:actions";
import { createPost, likePost } from "../lib/server/api";
import { currentToken, signToken, TOKEN_COOKIE } from "../lib/server/session";

export const server = {
  create: defineAction({
    accept: "form",
    handler: async (form, { cookies }) => {
      const token = currentToken(cookies);
      if (!token) throw new ActionError({ code: "UNAUTHORIZED" });
      const { status, data } = await createPost(`Bearer ${token}`, String(form.get("body") ?? ""));
      if (status !== 201) {
        throw new ActionError({ code: ActionError.statusToCode(status), message: data.error ?? `error ${status}` });
      }
      return null;
    },
  }),
  like: defineAction({
    accept: "form",
    handler: async (form, { cookies }) => {
      const token = currentToken(cookies);
      if (!token) throw new ActionError({ code: "UNAUTHORIZED" });
      await likePost(`Bearer ${token}`, String(form.get("id")));
      return null;
    },
  }),
  login: defineAction({
    accept: "form",
    handler: async (form, { cookies }) => {
      const id = Number(form.get("user_id"));
      const username = String(form.get("username") ?? "").trim();
      if (!Number.isInteger(id) || id < 1 || !username) throw new ActionError({ code: "BAD_REQUEST" });
      cookies.set(TOKEN_COOKIE, signToken(id, username), { httpOnly: true, sameSite: "lax", path: "/", secure: false });
      return null;
    },
  }),
};
