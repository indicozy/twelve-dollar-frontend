import { redirect } from '@sveltejs/kit';
import { signToken, TOKEN_COOKIE } from '#lib/server/session.ts';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ cookies, request }) => {
		const form = await request.formData();
		const id = Number(form.get('user_id'));
		const username = String(form.get('username') ?? '').trim();
		if (!Number.isInteger(id) || id < 1 || !username) redirect(303, '/login?error=1');
		cookies.set(TOKEN_COOKIE, signToken(id, username), { httpOnly: true, sameSite: 'lax', path: '/', secure: false });
		redirect(303, '/');
	}
};
