import { HttpStatusCode } from "@solidjs/start";

export function NotFound() {
  return (
    <div class="empty">
      <HttpStatusCode code={404} />
      <h1>Not found</h1>
      <a href="/">← back to feed</a>
    </div>
  );
}
