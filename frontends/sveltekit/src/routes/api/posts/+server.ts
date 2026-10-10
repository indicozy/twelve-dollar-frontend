// JSON passthrough so load tests can write through the frontend server (Authorization header forwarded).
import { createPost } from '#lib/server/api.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const authorization = request.headers.get('authorization');
	let body = '';
	try {
		body = String((await request.json()).body ?? '');
	} catch {
		return Response.json({ error: 'malformed JSON body' }, { status: 400 });
	}
	const { status, data } = await createPost(authorization, body);
	return Response.json(data, { status });
};
