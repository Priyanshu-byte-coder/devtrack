"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export default function GithubSignInButton() {
const [isLoading, setIsLoading] = useState(false);

const handleSignIn = async () => {
if (isLoading) return;


setIsLoading(true);

try {
  await signIn("github", {
    callbackUrl: "/dashboard",
  });
} catch (error) {
  console.error("GitHub sign-in failed:", error);
  setIsLoading(false);
}

};

return (
<button
onClick={handleSignIn}
disabled={isLoading}
className={`         flex items-center justify-center gap-3
        bg-black text-white py-4 rounded-xl font-semibold
        transition duration-300 w-full
        ${
          isLoading
            ? "cursor-wait opacity-80"
            : "cursor-pointer hover:scale-105 hover:opacity-90"
        }
      `}
>
{isLoading ? (
<> <svg
         className="h-5 w-5 animate-spin"
         xmlns="http://www.w3.org/2000/svg"
         fill="none"
         viewBox="0 0 24 24"
       > <circle
           cx="12"
           cy="12"
           r="10"
           stroke="currentColor"
           strokeWidth="4"
           opacity="0.25"
         /> <path
           fill="currentColor"
           d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
         /> </svg>


      Redirecting...
    </>
  ) : (
    <>
      <span className="text-2xl">🐙</span>
      Continue with GitHub
    </>
  )}
</button>


);
}
