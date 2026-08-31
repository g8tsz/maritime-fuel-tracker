"use client";

import { useTransition } from "react";
import { logoutAction } from "./logout";

export function LogoutButton() {
  const [pending, start] = useTransition();
  return (
    <button type="button" className="secondary" disabled={pending} onClick={() => start(() => logoutAction())}>
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
