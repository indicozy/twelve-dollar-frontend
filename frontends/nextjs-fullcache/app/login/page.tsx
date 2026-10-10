import { loginAction } from "../actions";

export default function Login() {
  return (
    <form action={loginAction} className="login">
      <h1>Sign in</h1>
      <p className="muted">
        The API has no login endpoint; this signs a demo HS256 token (like the challenge&apos;s seed tokens).
      </p>
      <label>
        User id <input name="user_id" type="number" min={1} defaultValue={1} required />
      </label>
      <label>
        Username <input name="username" defaultValue="golden_ember_1" required />
      </label>
      <button type="submit">Continue</button>
    </form>
  );
}
