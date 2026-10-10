import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { createPostAction } from "../lib/server-fns";

export function Compose() {
  const create = useServerFn(createPostAction);
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setPending(true);
    try {
      const res = await create({ data: new FormData(form) });
      setError(res.error);
      if (!res.error) form.reset();
      await queryClient.invalidateQueries({ queryKey: ["feed"] });
    } finally {
      setPending(false);
    }
  }

  return (
    <form method="post" action={createPostAction.url} className="compose" onSubmit={onSubmit}>
      <textarea name="body" maxLength={500} placeholder="What's happening on the $12 server?" required rows={3} />
      <div>
        {error ? <span className="error">{error}</span> : <span className="muted">max 500 chars</span>}
        <button type="submit" disabled={pending}>
          {pending ? "Posting…" : "Post"}
        </button>
      </div>
    </form>
  );
}
