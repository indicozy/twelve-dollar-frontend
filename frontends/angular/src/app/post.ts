export type Post = {
  id: number;
  body: string;
  created_at: string;
  author: string;
  like_count: number;
};

/** What the form endpoints in server.ts answer to an enhanced (fetch) submit. */
export type ActionResult = { redirect?: string; error?: string | null };

const fmt = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' });

export const formatDate = (iso: string) => `${fmt.format(new Date(iso))} UTC`;
