"use client";

import type { ComponentType } from "react";
import nextDynamic from "next/dynamic";

import { AuthProvider } from "@/lib/auth-shim";
import { ThemeProvider } from "@/hooks/useTheme";

type RouteComponentProps = Record<string, unknown>;
type RouteComponent = ComponentType<RouteComponentProps>;

const RelatorioAvaliacoesPage = nextDynamic<RouteComponentProps>(
  () =>
    import("@/views/RelatorioAvaliacoes").then(
      (mod) => mod.default as unknown as RouteComponent
    ),
  {
    ssr: false,
  }
);

export default function ClientPage() {
  return <AuthProvider><ThemeProvider><RelatorioAvaliacoesPage /></ThemeProvider></AuthProvider>;
}
