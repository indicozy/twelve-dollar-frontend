import { likePost } from '#lib/server/api.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, params }) => {
	const { status, data } = await likePost(request.headers.get('authorization'), params.id);
	return Response.json(data, { status });
};
