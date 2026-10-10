import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import type { FormEvent } from "react";
import { usernameQuery } from "../lib/queries";
import { loginAction } from "../lib/server-fns";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const login = useServerFn(loginAction);
  const queryClient = useQueryClient();

  // With JS: RPC call; useServerFn follows the server function's redirect to "/" as a client navigation (the root
  // route's loader isn't re-run by it, so the header's name is refetched explicitly). Without JS: native post to
  // loginAction.url, answered with a 303 to "/".
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await login({ data: new FormData(e.currentTarget) });
    await queryClient.invalidateQueries({ queryKey: usernameQuery.queryKey });
  }

  return (
    <form method="post" action={loginAction.url} className="login" onSubmit={onSubmit}>
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
    </form>
  );
}
