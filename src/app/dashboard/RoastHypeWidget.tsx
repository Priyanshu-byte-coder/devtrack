"use client";

import { useState } from 'react';
import { Copy, Sparkles, Flame } from 'lucide-react';

interface UserStats {
  commits: number;
  languages: string[];
  mergedPRs: number;
  failedGoals: number;
}

export default function RoastHypeWidget({ stats }: { stats: UserStats }) {
  const [mode, setMode] = useState<'roast' | 'hype'>('hype');
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateContent = async () => {
    setLoading(true);
    setOutput(null);
    setCopied(false);

    try {
      const response = await fetch('/api/ai/roast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, stats }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setOutput(data.message);
      } else {
        setOutput('Error generating content. Please try again.');
      }
    } catch (error) {
      setOutput('Network error. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (output) {
      navigator.clipboard.writeText(`DevTrack ${mode === 'hype' ? 'Hype' : 'Roast'}:\n"${output}"\n\nTrack your stats at devtrack.app! 🚀`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="p-6 bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm w-full">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-[var(--card-foreground)] dark:text-white flex items-center gap-2">
          {mode === 'hype' ? <Sparkles className="text-yellow-400 h-5 w-5" /> : <Flame className="text-red-500 h-5 w-5" />}
          Get {mode === 'hype' ? 'Hyped' : 'Roasted'}
        </h3>
        
        <div className="flex items-center bg-[var(--background)] border border-[var(--border)] rounded-full p-1">
          <button
            onClick={() => setMode('hype')}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
              mode === 'hype' ? 'bg-[var(--accent)] text-[var(--background)] shadow-sm' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            Hype
          </button>
          <button
            onClick={() => setMode('roast')}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
              mode === 'roast' ? 'bg-[var(--accent)] text-[var(--background)] shadow-sm' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            Roast
          </button>
        </div>
      </div>

      <button
        onClick={generateContent}
        disabled={loading}
        className="w-full py-2.5 px-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:shadow-lg hover:scale-[1.02] active:scale-95 text-white text-sm font-bold rounded-lg transition-all disabled:opacity-70 flex justify-center items-center"
      >
        {loading ? (
          <span className="animate-pulse">Consulting the AI...</span>
        ) : (
          `Generate ${mode === 'hype' ? 'Motivation' : 'Reality Check'}`
        )}
      </button>

      {output && (
        <div className="mt-5 p-4 bg-[var(--background)] border border-[var(--border)] rounded-lg relative group">
          <p className="text-[var(--foreground)] pr-6 text-sm italic">&ldquo;{output}&rdquo;</p>
          <button
            onClick={copyToClipboard}
            className="absolute top-3 right-3 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            title="Copy to clipboard"
          >
            {copied ? (
              <span className="text-[10px] text-green-500 font-bold uppercase tracking-wider">Copied!</span>
            ) : (
              <Copy size={16} />
            )}
          </button>
        </div>
      )}
    </div>
  );
}