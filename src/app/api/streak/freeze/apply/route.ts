import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST() {
  try {
    // Get the authenticated user
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's current freeze data
    const { data: profile, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('freeze_tokens_remaining, last_freeze_date, freeze_history')
      .eq('email', session.user.email)
      .single();

    if (fetchError) {
      console.error('Error fetching profile:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch user profile' },
        { status: 500 }
      );
    }

    // Check if user has tokens available
    const tokens = profile?.freeze_tokens_remaining ?? 0;
    if (tokens <= 0) {
      return NextResponse.json(
        { error: 'No freeze tokens available' },
        { status: 400 }
      );
    }

    // Check if user has already frozen today
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    if (profile?.last_freeze_date) {
      const lastFreezeDate = new Date(profile.last_freeze_date)
        .toISOString()
        .split('T')[0];
      if (lastFreezeDate === today) {
        return NextResponse.json(
          { error: 'You have already frozen today' },
          { status: 400 }
        );
      }
    }

    // Create freeze history entry
    const freezeEntry = {
      date: new Date().toISOString(),
      reason: 'Manual freeze'
    };

    const currentHistory = profile?.freeze_history || [];
    const updatedHistory = [...currentHistory, freezeEntry];

    // Update the profile
    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        freeze_tokens_remaining: tokens - 1,
        last_freeze_date: new Date().toISOString(),
        freeze_history: updatedHistory
      })
      .eq('email', session.user.email)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating freeze:', updateError);
      return NextResponse.json(
        { error: 'Failed to apply freeze' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Streak frozen successfully! ❄️',
      tokensRemaining: updatedProfile.freeze_tokens_remaining,
      lastFreezeDate: updatedProfile.last_freeze_date,
      freezeHistory: updatedProfile.freeze_history
    });
  } catch (error) {
    console.error('Error in apply freeze API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}