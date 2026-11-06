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
    <SessionProvider>
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
