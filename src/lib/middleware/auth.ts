import { NextRequest, NextResponse } from 'next/server';

export const handleAuth = (req: NextRequest) => {
  // Modularized authentication middleware logic
  const token = req.cookies.get('auth-token');
  if (!token) return NextResponse.redirect(new URL('/login', req.url));
  return NextResponse.next();
};
