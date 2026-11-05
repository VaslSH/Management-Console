'use client';

import { ApplicationsView } from '@/features/console/applications-view';
import { Shell } from '@/features/console/shell';

export default function ApplicationsPage() {
  return (
    <Shell>
      <ApplicationsView />
    </Shell>
  );
}
