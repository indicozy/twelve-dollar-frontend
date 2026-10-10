// Server functions: the only bridge between the browser and the API. Their handlers run on the server (directly
// during SSR, over Start's RPC endpoint after hydration), so BACKEND_URL and the token never reach the browser.
import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, getRequestHeader, setCookie } from "@tanstack/react-start/server";
import { createPost, getFeed, getPost, likePost } from "../server/api.server";
import { currentToken, currentUsername, signToken, TOKEN_COOKIE } from "../server/session.server";

// ---- reads (query functions) ----

export const fetchFeed = createServerFn({ method: "GET" }).handler(() => getFeed());

export const fetchPost = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(({ data: id }) => getPost(id));

export const fetchUsername = createServerFn({ method: "GET" }).handler(() => currentUsername());

// ---- writes (form submissions) ----
//
// Each form posts natively to the server function's URL (`fn.url`), so it works without JavaScript; with
// JavaScript the form's onSubmit calls the function over RPC instead and invalidates the queries.

/** True when the call comes from Start's client RPC (JS); false for a plain HTML form post. */
const isRpc = () => getRequestHeader("x-tsr-serverfn") === "true";

/** Without JS, answer a form post with a 303 back to the page it came from (same-origin Referer, else `/`). */
function backToReferer(): never {
  let to = "/";
  const referer = getRequestHeader("referer");
  if (referer) {
    try {
      const ref = new URL(referer);
      if (ref.origin === new URL(getRequest().url).origin) to = ref.pathname + ref.search;
    } catch {}
  }
  throw redirect({ href: to, statusCode: 303 });
}

function requireToken(): string {
  const token = currentToken();
  if (!token) throw redirect({ to: "/login", statusCode: 303 });
  return token;
}

const field = (form: FormData, name: string) => String(form.get(name) ?? "");

export const likeAction = createServerFn({ method: "POST" })
  .validator((form: FormData) => ({ id: field(form, "id") }))
  .handler(async ({ data }) => {
    const token = requireToken();
    await likePost(`Bearer ${token}`, data.id);
    if (!isRpc()) backToReferer();
    return { ok: true };
  });

export const createPostAction = createServerFn({ method: "POST" })
  .validator((form: FormData) => ({ body: field(form, "body") }))
  .handler(async ({ data }): Promise<{ error: string | null }> => {
    const token = requireToken();
    const { status, data: res } = await createPost(`Bearer ${token}`, data.body);
    if (!isRpc()) backToReferer(); // no-JS: the error (if any) is not shown, the page just reloads
    if (status !== 201) return { error: res.error ?? `error ${status}` };
    return { error: null };
  });

export const loginAction = createServerFn({ method: "POST" })
  .validator((form: FormData) => ({ id: Number(form.get("user_id")), username: field(form, "username").trim() }))
  .handler(({ data }) => {
    if (!Number.isInteger(data.id) || data.id < 1 || !data.username) {
      throw redirect({ href: "/login?error=1", statusCode: 303 });
    }
    setCookie(TOKEN_COOKIE, signToken(data.id, data.username), { httpOnly: true, sameSite: "lax", path: "/" });
    throw redirect({ to: "/", statusCode: 303 });
  });
