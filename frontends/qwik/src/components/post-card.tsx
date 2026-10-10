import { Form, Link, type ActionStore } from '@builder.io/qwik-city';
import type { Post } from '../lib/server/api';

const fmt = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' });

/**
 * Inline (non-`component$`) component: rendered as part of its parent, so 20 cards don't create 20 component
 * boundaries. The like action is passed in because inline components can't call `use*` hooks.
 */
export const PostCard = ({
	post,
	like,
	link = true
}: {
	post: Post;
	like: ActionStore<unknown, Record<string, unknown>, true>;
	link?: boolean;
}) => (
	// Qwik's SSR always emits `class` after the other attributes: `<article data-post-id="1" class="post">`.
	<article key={post.id} class="post" data-post-id={post.id}>
		<header>
			<span class="author">@{post.author}</span>
			{/* Qwik renders attribute names as typed and its types only accept `dateTime`; the spread keeps `datetime`. */}
			<time {...{ datetime: post.created_at }}>{fmt.format(new Date(post.created_at))} UTC</time>
		</header>
		<p>{post.body}</p>
		<footer>
			<Form action={like}>
				<input type="hidden" name="id" value={post.id} />
				<button type="submit" class="like">
					♥ <span>{post.like_count}</span>
				</button>
			</Form>
			{link ? (
				<Link href={`/posts/${post.id}`} prefetch={false}>
					#{post.id}
				</Link>
			) : (
				<span class="muted">#{post.id}</span>
			)}
		</footer>
	</article>
);
