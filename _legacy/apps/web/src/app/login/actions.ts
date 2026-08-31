"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { login, setSessionCookie } from "@/lib/auth-context";
import { getClientIp } from "@/lib/client-ip";
import { allow } from "@/lib/rate-limit";

export type LoginState = { error?: string };

const LOGIN_FAIL_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_FAIL_MAX = 20;

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const h = await headers();
  const ip = getClientIp(h);
  const user = await login(email, password);
  if (!user) {
    if (!allow(`loginfail:${email}:${ip}`, LOGIN_FAIL_MAX, LOGIN_FAIL_WINDOW_MS)) {
      return { error: "Too many failed sign-in attempts. Try again later." };
    }
    return { error: "Invalid credentials" };
  }
  await setSessionCookie(user.id);
  redirect("/dashboard");
}
