"use client";

import { useActionState } from "react";
import { createPostAction, type ComposeState } from "./actions";

export function Compose() {
  const [state, action, pending] = useActionState<ComposeState, FormData>(createPostAction, { error: null });
  return (
    <form action={action} className="compose">
      <textarea name="body" maxLength={500} placeholder="What's happening on the $12 server?" required rows={3} />
      <div>
        {state.error ? <span className="error">{state.error}</span> : <span className="muted">max 500 chars</span>}
        <button type="submit" disabled={pending}>
          {pending ? "Posting…" : "Post"}
        </button>
      </div>
    </form>
  );
}
