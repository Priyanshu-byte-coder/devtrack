"use client";

import type { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { AccountProvider } from "@/components/AccountContext";
import { ThemeProvider } from "@/components/ThemeContext";
import BackToTopButton from "@/components/BackToTopButton";
import Buddy from "@/components/buddy/Buddy";
import GlobalKeyboardShortcuts from "@/components/GlobalKeyboardShortcuts";
import MotionProvider from "@/components/motion/MotionProvider";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    // No refetch on tab focus: each one was a function invocation for every
    // visitor, signed in or not. Sign-in and sign-out still update all tabs.
    <SessionProvider refetchOnWindowFocus={false}>
      <AccountProvider>
        <ThemeProvider>
          <MotionProvider>
            {children}
            <BackToTopButton />
            <Buddy />
            <GlobalKeyboardShortcuts />
          </MotionProvider>
        </ThemeProvider>
      </AccountProvider>
    </SessionProvider>
  );
}
