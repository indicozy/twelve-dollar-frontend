import { redirect } from "react-router";
import { likePost } from "./api.server";
import { currentToken } from "./session.server";

/** The like form, shared by the feed page and the post page. Loaders revalidate after the action. */
export async function like(request: Request, form: FormData) {
  const token = currentToken(request);
  if (!token) throw redirect("/login");
  await likePost(`Bearer ${token}`, String(form.get("id")));
  return null;
}
