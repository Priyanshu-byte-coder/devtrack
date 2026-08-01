import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveAppUser } from "@/lib/resolve-user";

import {
  upstashRateLimitFixedWindow,
  getUpstashConfig,
} from "@/lib/upstash-rest";

import { createMemoryFixedWindowRateLimiter } from "@/lib/rate-limit";

// Initialize the Google Generative AI SDK
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const AI_ROAST_LIMIT = 5;
const AI_ROAST_WINDOW_SECONDS = 60 * 60;

const memoryLimiter = createMemoryFixedWindowRateLimiter({
  windowMs: AI_ROAST_WINDOW_SECONDS * 1000,
  pruneIntervalMs: AI_ROAST_WINDOW_SECONDS * 1000,
  maxEntries: 10_000,
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
const user = await resolveAppUser(
  session.githubId,
  session.githubLogin
);

if (!user) {
  return NextResponse.json(
    { error: "User not found" },
    { status: 404 }
  );
}

const userId = user.id;

if (!session?.githubId) {
  return NextResponse.json(
    { error: "Unauthorized" },
    { status: 401 }
  );
}

  try { 
    const body = await req.json();
    const { mode, stats } = body;

    if (!mode || !stats) {
      return NextResponse.json(
        { error: 'Mode (roast/hype) and user stats are required.' },
        { status: 400 }
      );
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    let systemInstruction = '';
    if (mode === 'roast') {
      systemInstruction = `You are a hilariously brutal, sarcastic senior developer reviewing a junior's code stats. Roast their coding habits, commit streaks, or languages used based on the provided stats. Keep it strictly safe for work (SFW), funny, and under 3 sentences. No cursing.`;
    } else if (mode === 'hype') {
      systemInstruction = `You are the ultimate enthusiastic developer hype-man. Look at the user's coding stats and hype them up! Make them feel like a 10x coding god. Keep it energetic, modern, and under 3 sentences.`;
    } else {
      return NextResponse.json({ error: 'Invalid mode.' }, { status: 400 });
    }

    const prompt = `
      ${systemInstruction}
      
      User Stats:
      - Commits this week: ${stats.commits || 0}
      - Top Languages: ${stats.languages?.join(', ') || 'None'}
      - Merged PRs: ${stats.mergedPRs || 0}
      - Failed Goals: ${stats.failedGoals || 0}
      
      Give me the ${mode}!
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    return NextResponse.json({ message: responseText.trim() });
  } catch (error) {
    console.error('Gemini API Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate response. Please try again.' },
      { status: 500 }
    );
  }
}