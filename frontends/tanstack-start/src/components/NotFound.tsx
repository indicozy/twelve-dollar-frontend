import { Link } from "@tanstack/react-router";

export function NotFound() {
  return (
    <div className="empty">
      <h1>Not found</h1>
      <Link to="/">← back to feed</Link>
    </div>
  );
}
