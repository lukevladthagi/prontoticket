"use client";

import type { ComponentType } from "react";
import nextDynamic from "next/dynamic";

import { AuthProvider } from "@/lib/auth-shim";
import { ThemeProvider } from "@/hooks/useTheme";

type RouteComponentProps = Record<string, unknown>;
type RouteComponent = ComponentType<RouteComponentProps>;

const CorrigirSetorRecorrentePage = nextDynamic<RouteComponentProps>(
  () =>
    import("@/views/CorrigirSetorRecorrente").then(
      (mod) => mod.default as unknown as RouteComponent
    ),
  {
    ssr: false,
  }
);

export default function ClientPage() {
  return <AuthProvider><ThemeProvider><CorrigirSetorRecorrentePage /></ThemeProvider></AuthProvider>;
}
