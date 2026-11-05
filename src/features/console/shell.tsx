'use client';

import { Icons, type Icon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { clearSession, hasSystemAccess, isHostedPreview, readSession, type Session } from '@/lib/session';
import { toast } from 'sonner';
import { ThemeSwitch } from './theme-switch';

const links: { href: string; label: string; system: boolean; icon: Icon }[] = [
  { href: '/dashboard/', label: 'Overview', system: true, icon: Icons.dashboard },
  { href: '/applications/', label: 'Applications', system: false, icon: Icons.apps },
  { href: '/cluster/', label: 'Cluster', system: true, icon: Icons.server },
  { href: '/settings/', label: 'Settings', system: true, icon: Icons.settings },
  { href: '/logs/', label: 'Logs', system: true, icon: Icons.post },
  { href: '/support/', label: 'Support', system: false, icon: Icons.help }
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [cluster, setCluster] = useState(false);

  useEffect(() => {
    const current = readSession();
    if (!current) {
      router.replace('/login/');
      return;
    }
    setSession(current);
    if (isHostedPreview()) return;
    api<{ success?: boolean }>('/cluster-mode-status')
      .then((data) => setCluster(Boolean(data?.success)))
      .catch(() => setCluster(false));

    async function confirmSession() {
      try {
        const status = await api<{ success?: boolean }>('/authentication-status');
        if (status && status.success === false) {
          clearSession();
          router.replace('/login/');
        }
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          clearSession();
          router.replace('/login/');
        }
      }
    }
    confirmSession();
    const timer = window.setInterval(confirmSession, 15000);
    return () => window.clearInterval(timer);
  }, [router]);

  if (!session) {
    return <div className='text-muted-foreground p-8 text-sm'>Checking session…</div>;
  }

  const system = hasSystemAccess(session.access);
  const visible = links.filter((link) => {
    if (link.href === '/cluster/') return system && cluster;
    if (link.system) return system;
    return true;
  });

  async function logout() {
    try {
      await api('/users/logout', { method: 'DELETE' });
      toast.success('Signed out.');
    } catch {
      toast.success('Signed out.');
    }
    clearSession();
    router.replace('/login/');
  }

  return (
    <div className='min-h-screen'>
      <header className='border-border bg-background/80 sticky top-0 z-30 border-b backdrop-blur-md'>
        <div className='flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 md:px-8'>
          <Link href={system ? '/dashboard/' : '/applications/'} className='shrink-0'>
            <img src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/vasl-logo.png`} alt='Vasl' className='vasl-wordmark h-10 w-auto' />
          </Link>
          <nav className='flex min-w-0 flex-1 flex-wrap items-center gap-1'>
            {visible.map((link) => {
              const active = pathname === link.href || pathname.startsWith(link.href);
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm',
                    active ? 'text-foreground border-primary border-b-2' : 'text-muted-foreground hover:text-foreground border-b-2 border-transparent'
                  )}
                >
                  <Icon className='size-4 shrink-0' />
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className='ml-auto flex items-center gap-1'>
            <ThemeSwitch />
            <span className='text-muted-foreground mr-2 ml-2 hidden max-w-40 truncate font-mono text-xs sm:inline'>{session.email}</span>
            <Link href='/account/password/' aria-label='Change password' className='text-muted-foreground hover:text-foreground inline-flex size-8 items-center justify-center'>
              <Icons.lock className='size-4' />
            </Link>
            <button type='button' onClick={logout} aria-label='Log out' className='text-muted-foreground hover:text-foreground inline-flex size-8 items-center justify-center'>
              <Icons.logout className='size-4' />
            </button>
          </div>
        </div>
      </header>
      <main className='min-w-0 px-4 py-6 md:px-8 md:py-8'>{children}</main>
    </div>
  );
}

export function PageTitle({ kicker, title, action }: { kicker: string; title: string; action?: React.ReactNode }) {
  return (
    <div className='mb-6 flex flex-wrap items-end justify-between gap-3'>
      <div>
        <p className='vasl-kicker'>{kicker}</p>
        <h1 className='font-[family-name:var(--font-display)] mt-1 text-3xl leading-none font-bold tracking-normal uppercase'>{title}</h1>
      </div>
      {action}
    </div>
  );
}

export function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn('border-border bg-card/80 rounded-lg border', className)}>{children}</section>;
}

export function Notice({
  tone,
  children,
  action
}: {
  tone: 'info' | 'warn' | 'bad';
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const Icon = tone === 'info' ? Icons.info : Icons.warning;
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm',
        tone === 'info' && 'border-primary/40 bg-primary/10',
        tone === 'warn' && 'border-chart-2/50 bg-chart-2/10',
        tone === 'bad' && 'border-destructive/40 bg-destructive/10 text-destructive'
      )}
    >
      <p className='flex min-w-0 items-start gap-2.5'>
        <Icon className='mt-0.5 size-4 shrink-0' />
        <span>{children}</span>
      </p>
      {action}
    </div>
  );
}

export function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Panel className='px-4 py-3'>
      <p className='text-muted-foreground font-mono text-[11px] tracking-[0.14em] uppercase'>{label}</p>
      <p className='font-[family-name:var(--font-display)] mt-1 text-3xl leading-none font-bold tabular-nums'>{value}</p>
      {hint ? <p className='text-muted-foreground mt-1 text-xs'>{hint}</p> : null}
    </Panel>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className='flex flex-col gap-1.5 text-sm'>
      <span className='text-muted-foreground'>{label}</span>
      {children}
    </label>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className='text-muted-foreground px-4 py-8 text-sm'>{children}</p>;
}

export function useBusy() {
  const [busy, setBusy] = useState(false);
  return { busy, setBusy };
}

export { Button };
