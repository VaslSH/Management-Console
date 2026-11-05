'use client';

import { readSession, hasSystemAccess } from '@/lib/session';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function HomePage() {
  const router = useRouter();
  useEffect(() => {
    const session = readSession();
    if (!session) {
      router.replace('/login/');
      return;
    }
    router.replace(hasSystemAccess(session.access) ? '/dashboard/' : '/applications/');
  }, [router]);
  return null;
}
