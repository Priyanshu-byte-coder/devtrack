"use client";

import { useEffect, useState } from "react";
import { useTheme } from "./ThemeContext";

export default function ProfileThemeWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const { themeMode } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div
      className={
        themeMode === "dark"
          ? "bg-[#020817] text-white min-h-screen"
          : "bg-white text-black min-h-screen"
      }
    >
      {children}
    </div>
  );
}