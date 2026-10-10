import { useEffect, useRef } from "react";
import { Form, redirect, useNavigation } from "react-router";
import type { Route } from "./+types/home";
import { PostCard } from "~/components/post-card";
import { createPost, getFeed } from "~/lib/api.server";
import { like } from "~/lib/like.server";
import { currentToken } from "~/lib/session.server";

// Rendered on every request from a fresh API call (no caching), like frontends/nextjs.
export async function loader() {
  return { posts: await getFeed() };
}

// One action for the page's two forms: the like form sends `id`, the compose form sends `body`.
export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  if (form.has("id")) return like(request, form);
  const token = currentToken(request);
  if (!token) throw redirect("/login");
  const { status, data } = await createPost(`Bearer ${token}`, String(form.get("body") ?? ""));
  if (status !== 201) return { error: data.error ?? `error ${status}`, created: false };
  return { error: null, created: true };
}

function Compose({ error, created }: { error?: string | null; created?: boolean }) {
  const navigation = useNavigation();
  const pending = navigation.state === "submitting" && navigation.formData?.has("body") === true;
  const ref = useRef<HTMLFormElement>(null);
  // Clear the textarea after a successful post (React 19 form actions do this in the Next.js variant).
  useEffect(() => {
    if (created) ref.current?.reset();
  }, [created]);
  return (
    <Form method="post" className="compose" ref={ref}>
      <textarea name="body" maxLength={500} placeholder="What's happening on the $12 server?" required rows={3} />
      <div>
        {error ? <span className="error">{error}</span> : <span className="muted">max 500 chars</span>}
        <button type="submit" disabled={pending}>
          {pending ? "Posting…" : "Post"}
        </button>
      </div>
    </Form>
  );
}

export default function Home({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <>
      <Compose error={actionData?.error} created={actionData?.created} />
      <h1>Latest</h1>
      <section className="feed">
        {loaderData.posts.map((p) => (
          <PostCard key={p.id} post={p} />
        ))}
      </section>
    </>
  );
}
