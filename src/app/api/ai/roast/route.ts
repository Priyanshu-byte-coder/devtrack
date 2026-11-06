import { readBoundedText, RequestBodyTooLargeError } from "@/lib/request-body";
import { getServerSession } from "@/lib/server-session";
import { checkAiQuota } from "@/lib/ai-quota";
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Google Generative AI SDK
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session?.githubId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: 'AI provider is not configured' }, { status: 503 });
  let raw: string;
  try { raw = await readBoundedText(req, 8192); }
  catch(error) { return NextResponse.json({error: error instanceof RequestBodyTooLargeError ? 'Request too large' : 'Invalid body'}, {status:error instanceof RequestBodyTooLargeError ? 413 : 400}); }
  let body;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  const statsInput = body.stats;
  if (!statsInput || typeof statsInput !== 'object' || Array.isArray(statsInput) ||
      ['commits', 'mergedPRs', 'failedGoals'].some(key => statsInput[key] !== undefined && (!Number.isSafeInteger(statsInput[key]) || statsInput[key] < 0)) ||
      (statsInput.languages !== undefined && (!Array.isArray(statsInput.languages) || statsInput.languages.length > 20 || statsInput.languages.some((x: unknown) => typeof x !== 'string' || x.length > 80)))) {
    return NextResponse.json({ error: 'Invalid stats' }, { status: 400 });
  }
  if (!['roast', 'hype'].includes(body.mode)) return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  const quota = await checkAiQuota(session.githubId);
  if (quota) return quota;
  try {
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

    const result = await model.generateContent(prompt, { timeout: 15_000 });
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