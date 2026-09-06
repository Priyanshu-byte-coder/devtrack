import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    // Get the authenticated user
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's freeze data from Supabase
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('freeze_tokens_remaining, last_freeze_date, freeze_history')
      .eq('email', session.user.email)
      .single();

    if (error) {
      console.error('Error fetching freeze data:', error);
      return NextResponse.json(
        { error: 'Failed to fetch freeze status' },
        { status: 500 }
      );
    }

    // Calculate next freeze eligibility date (1 month from last freeze)
    let nextEligibleDate: Date | null = null;
    if (profile?.last_freeze_date) {
      const lastDate = new Date(profile.last_freeze_date);
      nextEligibleDate = new Date(lastDate.setMonth(lastDate.getMonth() + 1));
    }

    // Check if tokens should refresh (first of month)
    const today = new Date();
    const shouldRefresh = today.getDate() === 1 && 
      profile?.last_freeze_date && 
      new Date(profile.last_freeze_date).getMonth() !== today.getMonth();

    // If it's the first of the month and tokens are low, refresh them
    let tokens = profile?.freeze_tokens_remaining ?? 1;
    if (shouldRefresh) {
      tokens = 2; // Refresh to 2 tokens on the first of each month
      // Update tokens in database
      await supabaseAdmin
        .from('profiles')
        .update({ freeze_tokens_remaining: tokens })
        .eq('email', session.user.email);
    }

    // Calculate if user can freeze
    let canFreeze = false;
    if (tokens > 0) {
      if (!profile?.last_freeze_date) {
        canFreeze = true;
      } else if (nextEligibleDate) {
        canFreeze = new Date() >= nextEligibleDate;
      }
    }

    return NextResponse.json({
      tokensRemaining: tokens,
      lastFreezeDate: profile?.last_freeze_date || null,
      nextEligibleDate: nextEligibleDate ? nextEligibleDate.toISOString() : null,
      freezeHistory: profile?.freeze_history || [],
      canFreeze: canFreeze
    });
  } catch (error) {
    console.error('Error in freeze status API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}