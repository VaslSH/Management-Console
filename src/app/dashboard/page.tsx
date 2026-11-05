'use client';

import { DashboardView } from '@/features/console/dashboard-view';
import { Shell } from '@/features/console/shell';

export default function DashboardPage() {
  return (
    <Shell>
      <DashboardView />
    </Shell>
  );
}
