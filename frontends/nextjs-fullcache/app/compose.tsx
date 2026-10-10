"use client";

import { useActionState } from "react";
import { createPostAction, type ComposeState } from "./actions";

export function Compose() {
  const [state, action, pending] = useActionState<ComposeState, FormData>(createPostAction, { error: null, posted: false });
  return (
    <form action={action} className="compose">
      <textarea name="body" maxLength={500} placeholder="What's happening on the $12 server?" required rows={3} />
      <div>
        {state.error ? (
          <span className="error">{state.error}</span>
        ) : state.posted ? (
          <span className="muted">Posted. It appears in the feed within about 30 seconds.</span>
        ) : (
          <span className="muted">max 500 chars</span>
        )}
        <button type="submit" disabled={pending}>
          {pending ? "Posting…" : "Post"}
        </button>
      </div>
    </form>
  );
}
