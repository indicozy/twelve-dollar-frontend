import { error } from '@sveltejs/kit';
import { getPost } from '#lib/server/api.ts';
import { likeAction } from '#lib/server/like.ts';
import type { Actions, PageServerLoad } from './$types';

// The whole page renders before anything is sent, so a missing post is a real 404 (Next.js streams and sends 200).
export const load: PageServerLoad = async ({ params }) => {
	const post = await getPost(params.id);
	if (!post) error(404, 'Not found');
	return { post };
};

export const actions: Actions = { like: likeAction };
