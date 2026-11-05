'use client';

import { SettingsView } from '@/features/console/settings-view';
import { Shell } from '@/features/console/shell';

export default function SettingsPage() {
  return (
    <Shell>
      <SettingsView />
    </Shell>
  );
}
