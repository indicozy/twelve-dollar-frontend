// POST /api/posts/:id/like : JSON passthrough for the load test.
import { createRoute } from 'honox/factory';
import { likePost } from '../../../../lib/api';
import { passthrough } from '../../../../lib/forms';

export const POST = createRoute(async (c) => passthrough(await likePost(c.req.header('authorization'), c.req.param('id'))));
