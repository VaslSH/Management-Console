'use client';

import { ClusterView } from '@/features/console/cluster-view';
import { Shell } from '@/features/console/shell';

export default function ClusterPage() {
  return (
    <Shell>
      <ClusterView />
    </Shell>
  );
}
