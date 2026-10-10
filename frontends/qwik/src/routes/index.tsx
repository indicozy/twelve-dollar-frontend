import { component$ } from '@builder.io/qwik';
import { Form, routeLoader$ } from '@builder.io/qwik-city';
import { PostCard } from '../components/post-card';
import { useCreatePost, useLike } from '../lib/actions';
import { getFeed } from '../lib/server/api';

export { useCreatePost, useLike } from '../lib/actions';

// Rendered on every request from a fresh API call (no caching), like frontends/nextjs.
export const useFeed = routeLoader$(() => getFeed());

export default component$(() => {
	const posts = useFeed();
	const create = useCreatePost();
	const like = useLike();
	return (
		<>
			<Form action={create} class="compose" spaReset>
				<textarea
					name="body"
					{...{ maxlength: 500 }}
					placeholder="What's happening on the $12 server?"
					required
					rows={3}
				></textarea>
				<div>
					{create.value?.error ? (
						<span class="error">{create.value.error}</span>
					) : (
						<span class="muted">max 500 chars</span>
					)}
					<button type="submit" disabled={create.isRunning}>
						{create.isRunning ? 'Posting…' : 'Post'}
					</button>
				</div>
			</Form>
			<h1>Latest</h1>
			<section class="feed">
				{posts.value.map((post) => (
					<PostCard key={post.id} post={post} like={like} />
				))}
			</section>
		</>
	);
});
