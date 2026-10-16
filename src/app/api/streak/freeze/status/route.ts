// ==========================================
// API Route: Streak Freeze Status & Apply (#85400)
// ==========================================

import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // Mock response for current freeze status
  return NextResponse.json({
    freeze_tokens_remaining: 1,
    last_freeze_date: null,
    freeze_history: []
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  
  // Apply freeze logic
  return NextResponse.json({
    success: true,
    message: "Streak successfully frozen for today ❄️",
    freeze_tokens_remaining: 0,
    applied_date: body.date || new Date().toISOString()
  });
}
