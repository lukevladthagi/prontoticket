"use client";

import type { ReactNode } from "react";
import { authClient, useSession } from "./auth-client";

type BetterAuthSession = ReturnType<typeof useSession>;
type BetterAuthUser = NonNullable<
  NonNullable<BetterAuthSession["data"]>["user"]
>;
type MochaCompatUser = BetterAuthUser & {
  userName: string | null;
  google_sub: string | null;
  given_name: string | null;
  family_name: string | null;
  picture: string | null;
  email_verified: boolean | null;
  created_at: string | null;
  google_user_data: {
    sub: string | null;
    name: string | null;
    given_name: string | null;
    family_name: string | null;
    email: string | null;
    picture: string | null;
    email_verified: boolean | null;
  };
};

export type MochaUser = MochaCompatUser;

function splitName(name: string | null | undefined) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return {
    givenName: parts[0] ?? null,
    familyName: parts.length > 1 ? parts.slice(1).join(" ") : null,
  };
}

function toMochaDateString(value: string | Date | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function toMochaCompatUser(user: BetterAuthUser | null | undefined) {
  if (!user) return null;
  const { givenName, familyName } = splitName(user.name);
  const createdAt = toMochaDateString(user.createdAt);
  return {
    ...user,
    userName: user.name ?? null,
    google_sub: user.id ?? null,
    given_name: givenName,
    family_name: familyName,
    picture: user.image ?? null,
    email_verified: user.emailVerified ?? null,
    created_at: createdAt,
    google_user_data: {
      sub: user.id ?? null,
      name: user.name ?? null,
      given_name: givenName,
      family_name: familyName,
      email: user.email ?? null,
      picture: user.image ?? null,
      email_verified: user.emailVerified ?? null,
    },
  } satisfies MochaCompatUser;
}

// Mocha's @getmocha/users-service/react exposes a richer useAuth() than
// better-auth's useSession. We approximate the Mocha surface so user code
// keeps compiling. `exchangeCodeForSessionToken` is a no-op because
// better-auth handles the OAuth callback itself via /api/auth/[...all].
export function useAuth() {
  const session = useSession();
  const signOut = () => authClient.signOut();
  // Mocha's redirectToLogin accepts no args; user code commonly attaches it
  // directly to onClick, so don't tighten the signature.
  const redirectToLogin = () => {
    if (typeof window !== "undefined") window.location.href = "/account/signin";
  };
  return {
    user: toMochaCompatUser(session.data?.user),
    isPending: session.isPending,
    loading: session.isPending,
    error: session.error ?? null,
    signOut,
    logout: signOut,
    refetch: session.refetch,
    fetchUser: session.refetch,
    redirectToLogin,
    exchangeCodeForSessionToken: async () => {
      // better-auth completes OAuth on the server; nothing to do client-side.
    },
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
