"use client";

import { AuthProvider } from "@/lib/auth-shim";
import { ThemeProvider } from "@/hooks/useTheme";
import HomePage from "@/views/Home";

export default function ClientPage() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <HomePage />
      </ThemeProvider>
    </AuthProvider>
  );
}
