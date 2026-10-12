import { fail, redirect } from '@sveltejs/kit';
import { createPost, getFeed } from '#lib/server/api.ts';
import { likeAction } from '#lib/server/like.ts';
import { currentToken } from '#lib/server/session.ts';
import type { Actions, PageServerLoad } from './$types';

// Rendered on every request from a fresh API call (no caching), like frontends/nextjs.
export const load: PageServerLoad = async () => ({ posts: await getFeed() });

export const actions: Actions = {
	create: async ({ cookies, request }) => {
		const token = currentToken(cookies);
		if (!token) redirect(303, '/login');
		const form = await request.formData();
		const { status, data } = await createPost(`Bearer ${token}`, String(form.get('body') ?? ''));
		if (status !== 201) return fail(status, { error: data.error ?? `error ${status}` });
		return { error: null };
	},
	like: likeAction
};
