#!/bin/bash

echo "🔍 Scanning for potential SERVICE_ROLE_KEY exposure in client-side code..."

# This command searches for any mention of NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
if grep -r "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY" --include="*.{js,jsx,ts,tsx}" .; then
  echo "❌ Error: NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY found! This key must never be exposed on the client side."
  exit 1
else
  echo "✅ No client-side service key exposure detected."
  exit 0
fi