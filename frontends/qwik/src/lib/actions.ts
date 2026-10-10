// Form actions (routeAction$), re-exported by the route files that render the forms (Qwik City only runs actions
// exported from a route's index.tsx/layout.tsx). The bodies run on the server only.
import { routeAction$ } from '@builder.io/qwik-city';
import { createPost, likePost } from './server/api';
import { currentToken } from './server/session';

export const useLike = routeAction$(async (form, { cookie, redirect }) => {
	const token = currentToken(cookie);
	if (!token) throw redirect(303, '/login');
	await likePost(`Bearer ${token}`, String(form.id));
	// Qwik City re-runs the page's routeLoader$s after an action, so the new count is rendered.
});

export const useCreatePost = routeAction$(async (form, { cookie, redirect, fail }) => {
	const token = currentToken(cookie);
	if (!token) throw redirect(303, '/login');
	const { status, data } = await createPost(`Bearer ${token}`, String(form.body ?? ''));
	if (status !== 201) return fail(status, { error: data.error ?? `error ${status}` });
	return { error: null };
});
