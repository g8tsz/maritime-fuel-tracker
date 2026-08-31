"use client";

import { useActionState } from "react";
import type { LoginState } from "./actions";
import { loginAction } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, {} as LoginState);
  return (
    <form action={action} className="card" style={{ maxWidth: 420 }}>
      <h1 className="h1">Sign in</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Demo operator console for the maritime bunker station platform.
      </p>
      {state.error ? (
        <p style={{ color: "var(--danger)" }} role="alert">
          {state.error}
        </p>
      ) : null}
      <div style={{ display: "grid", gap: 12 }}>
        <label>
          Email
          <input name="email" type="email" autoComplete="username" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <button type="submit" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </div>
    </form>
  );
}
