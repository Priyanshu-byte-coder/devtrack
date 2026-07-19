"use client";

import { useState } from "react";
import { Link2, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface ShareProfileButtonProps {
  githubLogin: string;
}

export default function ShareProfileButton({
  githubLogin,
}: ShareProfileButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        "https://devtrack-silk-kappa.vercel.app";

      const profileUrl = `${baseUrl}/u/${githubLogin}`;

      await navigator.clipboard.writeText(profileUrl);

      setCopied(true);
      toast.success("Link copied!");

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  return (
    <Button onClick={handleCopy}>
      {copied ? (
        <>
          <Check className="mr-2 h-4 w-4" />
          Copied
        </>
      ) : (
        <>
          <Link2 className="mr-2 h-4 w-4" />
          Share Profile
        </>
      )}
    </Button>
  );
}
