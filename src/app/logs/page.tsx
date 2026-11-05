'use client';

import { LogsView } from '@/features/console/logs-view';
import { Shell } from '@/features/console/shell';

export default function LogsPage() {
  return (
    <Shell>
      <LogsView />
    </Shell>
  );
}
