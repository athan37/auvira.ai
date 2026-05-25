import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

// This page serves both authenticated and unauthenticated users
// For authenticated: go to dashboard to manage projects
// For unauthenticated: redirect to sign-in (which will show the app's home page after login)
export default async function Home() {
  const session = await auth();

  if (!session) {
    redirect('/auth/signin');
  }

  // Authenticated users go to dashboard
  redirect('/dashboard');
}