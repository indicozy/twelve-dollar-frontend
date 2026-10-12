import type { ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';

// API down or unexpected status on a page: a plain 500 (logged). HTTPExceptions (the CSRF 403) keep their response.
const handler: ErrorHandler = (err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  console.error(err);
  return c.text('Internal Server Error', 500);
};

export default handler;
