import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { parseSession, serializeSession, type SessionPayload } from "./session";
import { SESSION_COOKIE } from "./session-constants";
import type { Membership, User } from "@prisma/client";

export type AuthedUser = User & { memberships: Membership[] };

const SESSION_DAYS = 7;

export async function getSessionUser(): Promise<AuthedUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const payload = parseSession(token);
  if (!payload) return null;
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: { memberships: true },
  });
  return user;
}

export async function login(email: string, password: string): Promise<AuthedUser | null> {
  const bcrypt = await import("bcryptjs");
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { memberships: true },
  });
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  return user;
}

export async function setSessionCookie(userId: string) {
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload: SessionPayload = { userId, exp };
  const jar = await cookies();
  jar.set(SESSION_COOKIE, serializeSession(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}
