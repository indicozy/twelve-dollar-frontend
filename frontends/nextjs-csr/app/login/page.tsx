"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { setToken, tokenUsername } from "@/lib/api";

// No server to sign tokens (shipping JWT_SECRET to the browser would let anyone forge them), so sign-in
// takes a pre-signed token, e.g. one from research/ref-repo/seed/tokens.json.
export default function Login() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  function submit(form: FormData) {
    const token = String(form.get("token") ?? "").trim();
    if (!tokenUsername(token)) return setError("not a valid token");
    setToken(token);
    router.push("/");
  }

  return (
    <form action={submit} className="login">
      <h1>Sign in</h1>
      <p className="muted">Paste a JWT from the challenge&apos;s seed/tokens.json.</p>
      <label>
        Token <input name="token" required autoComplete="off" />
      </label>
      {error && <span className="error">{error}</span>}
      <button type="submit">Continue</button>
    </form>
  );
}
