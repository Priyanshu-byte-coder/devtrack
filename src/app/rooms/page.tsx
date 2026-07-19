import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getRoomsForUser } from '@/lib/supabase-rooms';
import RoomsListClient from './RoomsListClient';
import Link from 'next/link';

export const metadata = { title: 'Collaboration Rooms — DevTrack' };

export default async function RoomsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.name) redirect('/api/auth/signin');
  const rooms = await getRoomsForUser(session.user.name);
  return (
    <div className="min-h-screen p-6">
      <div className="max-w-3xl mx-auto mb-4">
        <Link
          href="/dashboard"
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          ← Back to Dashboard
        </Link>
      </div>
      <RoomsListClient initialRooms={rooms} currentUser={session.user.name} />
    </div>
  );
}