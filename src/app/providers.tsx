"use client";

import type { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { AccountProvider } from "@/components/AccountContext";
import { ThemeProvider } from "@/components/ThemeContext";
import BackToTopButton from "@/components/BackToTopButton";
import GlobalKeyboardShortcuts from "@/components/GlobalKeyboardShortcuts";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AccountProvider>
        <ThemeProvider>
          {children}
          <BackToTopButton />
          <GlobalKeyboardShortcuts />
        </ThemeProvider>
      </AccountProvider>
    </SessionProvider>
  );
}
