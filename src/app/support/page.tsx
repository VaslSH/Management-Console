'use client';

import { SupportView } from '@/features/console/support-view';
import { Shell } from '@/features/console/shell';

export default function SupportPage() {
  return (
    <Shell>
      <SupportView />
    </Shell>
  );
}
