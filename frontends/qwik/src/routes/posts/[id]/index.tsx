import { component$ } from '@builder.io/qwik';
import { Link, routeLoader$ } from '@builder.io/qwik-city';
import { NotFound } from '../../../components/not-found';
import { PostCard } from '../../../components/post-card';
import { useLike } from '../../../lib/actions';
import { getPost } from '../../../lib/server/api';

export { useLike } from '../../../lib/actions';

// The whole page renders before anything is sent, so a missing or invalid post is a real 404 (Next.js streams and
// sends 200). The not-found markup renders inside the layout, like SvelteKit's +error.svelte.
export const usePost = routeLoader$(async ({ params, status }) => {
	const post = await getPost(params.id);
	if (!post) status(404);
	return post;
});

export default component$(() => {
	const post = usePost();
	const like = useLike();
	if (!post.value) return <NotFound />;
	return (
		<>
			<Link href="/" class="back">
				← back to feed
			</Link>
			<PostCard post={post.value} like={like} link={false} />
		</>
	);
});
