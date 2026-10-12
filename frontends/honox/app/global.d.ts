import type {} from 'hono';

declare module 'hono' {
  interface ContextVariableMap {
    token: string | undefined;
    username: string | null;
  }
}
