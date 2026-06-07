"use client";

import type { ComponentType } from "react";
import nextDynamic from "next/dynamic";

import { AuthProvider } from "@/lib/auth-shim";
import { ThemeProvider } from "@/hooks/useTheme";

type RouteComponentProps = Record<string, unknown>;
type RouteComponent = ComponentType<RouteComponentProps>;

const LimparPrazoRespostaPage = nextDynamic<RouteComponentProps>(
  () =>
    import("@/views/LimparPrazoResposta").then(
      (mod) => mod.default as unknown as RouteComponent
    ),
  {
    ssr: false,
  }
);

export default function ClientPage() {
  return <AuthProvider><ThemeProvider><LimparPrazoRespostaPage /></ThemeProvider></AuthProvider>;
}
