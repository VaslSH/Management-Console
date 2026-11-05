'use client';

import { PasswordView } from '@/features/console/password-view';
import { Shell } from '@/features/console/shell';

export default function PasswordPage() {
  return (
    <Shell>
      <PasswordView />
    </Shell>
  );
}
