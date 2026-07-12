import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { resolveAppUser } from '@/lib/resolve-user';
import {
  upstashRateLimitFixedWindow,
  getUpstashConfig,
  upstashPipeline,
} from '@/lib/upstash-rest';
import { createMemoryFixedWindowRateLimiter } from '@/lib/rate-limit';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// Initialize the Google Generative AI SDK
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const ROAST_LIMIT = 5;
const ROAST_WINDOW_SECONDS = 60 * 60; // 1 hour
const CACHE_TTL_SECONDS = 5 * 60; // 5 minutes

// In-memory fallback rate limiter
const memoryLimiter = createMemoryFixedWindowRateLimiter({
  windowMs: ROAST_WINDOW_SECONDS * 1000,
  pruneIntervalMs: ROAST_WINDOW_SECONDS * 1000,
  maxEntries: 10_000,
});

// In-memory fallback response cache
type CacheEntry = { value: string; expiresAt: number };
const localCache = new Map<string, CacheEntry>();

export async function POST(req: Request) {
  try {
    // 1. Session check
    const session = await getServerSession(authOptions);
    if (!session?.githubId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Resolve application user
    const user = await resolveAppUser(session.githubId, session.githubLogin);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const userId = user.id;

    // 3. Parse and validate body
    const body = await req.json();
    const { mode, stats } = body;

    if (!mode || !stats) {
      return NextResponse.json(
        { error: 'Mode (roast/hype) and user stats are required.' },
        { status: 400 }
      );
    }

    if (mode !== 'roast' && mode !== 'hype') {
      return NextResponse.json({ error: 'Invalid mode.' }, { status: 400 });
    }

    // 4. Generate stats hash and check cache
    const sortedLanguages = stats.languages ? [...stats.languages].sort() : [];
    const statsString = JSON.stringify({
      commits: stats.commits || 0,
      languages: sortedLanguages,
      mergedPRs: stats.mergedPRs || 0,
      failedGoals: stats.failedGoals || 0,
    });
    const statsHash = crypto.createHash('sha256').update(statsString).digest('hex');
    const cacheKey = `roast-cache:${userId}:${mode}:${statsHash}`;

    // Read cache (Upstash Redis or in-memory)
    let cachedMessage: string | null = null;
    if (getUpstashConfig()) {
      try {
        const results = await upstashPipeline([['GET', cacheKey]]);
        cachedMessage = (results[0]?.result as string) || null;
      } catch (err) {
        console.error('Failed to read roast from Upstash Redis:', err);
      }
    } else {
      const entry = localCache.get(cacheKey);
      if (entry && Date.now() <= entry.expiresAt) {
        cachedMessage = entry.value;
      } else if (entry) {
        localCache.delete(cacheKey);
      }
    }

    if (cachedMessage) {
      return NextResponse.json({ message: cachedMessage, cached: true });
    }

    // 5. Rate limiting check
    let rateLimitDenied = false;
    let retryAfterSeconds = ROAST_WINDOW_SECONDS;

    if (getUpstashConfig()) {
      const result = await upstashRateLimitFixedWindow({
        key: `roast-limit:${userId}`,
        limit: ROAST_LIMIT,
        windowSeconds: ROAST_WINDOW_SECONDS,
      });
      if (!result.allowed) {
        rateLimitDenied = true;
        retryAfterSeconds = result.retryAfter ?? ROAST_WINDOW_SECONDS;
      }
    } else {
      const result = memoryLimiter.check(`roast-limit:${userId}`, ROAST_LIMIT);
      if (!result.allowed) {
        rateLimitDenied = true;
        retryAfterSeconds = Math.max(result.reset - Math.floor(Date.now() / 1000), 1);
      }
    }

    if (rateLimitDenied) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfterSeconds) },
        }
      );
    }

    // 6. Gemini Generation
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    let systemInstruction = '';
    if (mode === 'roast') {
      systemInstruction = `You are a hilariously brutal, sarcastic senior developer reviewing a junior's code stats. Roast their coding habits, commit streaks, or languages used based on the provided stats. Keep it strictly safe for work (SFW), funny, and under 3 sentences. No cursing.`;
    } else {
      systemInstruction = `You are the ultimate enthusiastic developer hype-man. Look at the user's coding stats and hype them up! Make them feel like a 10x coding god. Keep it energetic, modern, and under 3 sentences.`;
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
    const responseText = (result.response.text() || '').trim();

    if (!responseText) {
      throw new Error('Empty response received from Gemini.');
    }

    // 7. Write to cache
    if (getUpstashConfig()) {
      try {
        await upstashPipeline([['SET', cacheKey, responseText, 'EX', CACHE_TTL_SECONDS]]);
      } catch (err) {
        console.error('Failed to write roast to Upstash Redis:', err);
      }
    } else {
      localCache.set(cacheKey, {
        value: responseText,
        expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000,
      });
    }

    return NextResponse.json({ message: responseText });
  } catch (error) {
    console.error('Gemini API Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate response. Please try again.' },
      { status: 500 }
    );
  }
}