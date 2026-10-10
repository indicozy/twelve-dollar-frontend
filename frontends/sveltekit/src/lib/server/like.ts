import { redirect, type RequestEvent } from '@sveltejs/kit';
import { likePost } from './api';
import { currentToken } from './session';

/** The `like` form action, shared by the feed page and the post page. */
export async function likeAction({ cookies, request }: RequestEvent) {
	const token = currentToken(cookies);
	if (!token) redirect(303, '/login');
	const form = await request.formData();
	await likePost(`Bearer ${token}`, String(form.get('id')));
	// SvelteKit re-runs the page's load after an action, so the new count is rendered.
}
