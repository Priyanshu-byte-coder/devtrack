import Link from "next/link";
import GithubSignInButton from "@/components/GithubSignInButton";
export default function LoginRequiredPage() {
  return (
    <main className="relative min-h-screen flex items-center justify-center bg-[var(--background)] px-4 overflow-hidden">
      
      {/* Dynamic Background Glow Accents */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-purple-500/10 rounded-full blur-[120px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-blue-500/10 rounded-full blur-[120px] animate-pulse [animation-delay:2s] pointer-events-none" />

      {/* Main Interactive Card */}
      <div className="relative max-w-md w-full bg-[var(--card)]/80 backdrop-blur-md border border-[var(--border)] rounded-3xl p-10 shadow-2xl text-center group hover:border-[var(--muted-foreground)]/30 transition-all duration-500">
        
        {/* Floating Rocket Icon Container */}
        <div className="relative inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-[var(--border)] rounded-2xl mb-6 text-4xl shadow-inner group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
          <span className="animate-bounce [animation-duration:3s]">🚀</span>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-extrabold tracking-tight text-[var(--foreground)] mb-3 bg-gradient-to-r from-[var(--foreground)] via-[var(--foreground)] to-[var(--muted-foreground)] bg-clip-text">
          Unlock DevTrack Features
        </h1>

        {/* Description */}
        <p className="text-[var(--muted-foreground)] mb-8 text-sm leading-relaxed max-w-sm mx-auto">
          Sign in with your GitHub account to access premium features like <span className="text-[var(--foreground)] font-medium">streak tracking</span>, <span className="text-[var(--foreground)] font-medium">PR analytics</span>, and custom coding goals.
        </p>

        {/* Primary Action Button (Sign In) */}
        <GithubSignInButton />

        {/* Secondary Action (GitHub Link) */}
        <a
          href="https://github.com/Priyanshu-byte-coder/devtrack"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-6 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-200 group/link"
        >
          View project on GitHub 
          <span className="inline-block transform group-hover/link:translate-x-1 transition-transform duration-200">→</span>
        </a>
      </div>
    </main>
  );
}