// POST /api/posts : JSON passthrough for the load test (forwards Authorization as-is, returns the API's status + JSON).
import { createRoute } from 'honox/factory';
import { createPost } from '../../../lib/api';
import { passthrough } from '../../../lib/forms';

export const POST = createRoute(async (c) => {
  let body: string;
  try {
    // Strict parse of the raw body; `null` or an empty body throw too.
    body = String(JSON.parse(await c.req.text()).body ?? '');
  } catch {
    return c.json({ error: 'malformed JSON body' }, 400);
  }
  return passthrough(await createPost(c.req.header('authorization'), body));
});
