// The one island: the like form. Server-rendered as the same plain form as ../hono-jsx-bun (it still works without
// JS: POST /actions/like, 303 back). Once hydrated, a submit is sent with fetch (Accept: application/json), the
// route answers with the API's status instead of a redirect, and the count updates in place.
import { useState } from 'hono/jsx';

export default function LikeButton({ id, likes }: { id: number; likes: number }) {
  const [count, setCount] = useState(likes);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: Event) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch('/actions/like', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new URLSearchParams({ id: String(id) }),
      });
      if (r.status === 401) return location.assign('/login');
      if (r.status === 201) setCount((n) => n + 1); // 200 = already liked: unchanged
    } finally {
      setBusy(false);
    }
  };

  return (
    <form method="post" action="/actions/like" onSubmit={onSubmit}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" class="like">
        ♥ <span>{count}</span>
      </button>
    </form>
  );
}
