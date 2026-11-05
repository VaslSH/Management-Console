'use client';

import { Icons } from '@/components/icons';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function ThemeSwitch() {
  const { resolvedTheme, setTheme } = useTheme();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  const dark = resolvedTheme !== 'light';

  if (!ready) {
    return <div className='h-[18.4px] w-[4.75rem]' aria-hidden />;
  }

  return (
    <div className='text-muted-foreground flex items-center gap-1.5'>
      <Icons.sun className={cn('size-3.5', dark ? 'opacity-45' : 'text-foreground')} />
      <Switch
        checked={dark}
        onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
        aria-label={dark ? 'Dark theme on' : 'Dark theme off'}
      />
      <Icons.moon className={cn('size-3.5', dark ? 'text-foreground' : 'opacity-45')} />
    </div>
  );
}
