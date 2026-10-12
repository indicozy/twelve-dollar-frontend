import { Form, redirect } from "react-router";
import type { Route } from "./+types/login";
import { signToken, tokenCookie } from "~/lib/session.server";

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const id = Number(form.get("user_id"));
  const username = String(form.get("username") ?? "").trim();
  if (!Number.isInteger(id) || id < 1 || !username) throw redirect("/login?error=1");
  throw redirect("/", { headers: { "Set-Cookie": tokenCookie(signToken(id, username)) } });
}

export default function Login() {
  return (
    <Form method="post" className="login">
      <h1>Sign in</h1>
      <p className="muted">
        The API has no login endpoint; this signs a demo HS256 token (like the challenge&apos;s seed tokens).
      </p>
      <label>
        User id <input name="user_id" type="number" min={1} defaultValue={1} required />
      </label>
      <label>
        Username <input name="username" defaultValue="golden_ember_1" required />
      </label>
      <button type="submit">Continue</button>
    </Form>
  );
}
