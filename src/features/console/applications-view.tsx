'use client';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { api, namesOf } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { act } from './feedback';
import { Field, PageTitle } from './shell';
import { StreamsView } from './streams-view';

function ApplicationsBody() {
  const params = useSearchParams();
  const router = useRouter();
  const name = params.get('name') || '';
  const [apps, setApps] = useState<string[]>([]);
  const [nextName, setNextName] = useState('');
  const [war, setWar] = useState<File | null>(null);
  const [adding, setAdding] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  async function load() {
    try {
      const data = await api('/applications');
      setApps(namesOf(data));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not list applications.');
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!loaded || name || apps.length === 0) return;
    router.replace(`/applications/?name=${encodeURIComponent(apps[0])}`);
  }, [loaded, name, apps, router]);

  function closeCreate() {
    if (creating) return;
    setAdding(false);
    setNextName('');
    setWar(null);
  }

  async function createApp(event: React.FormEvent) {
    event.preventDefault();
    if (creating) return;
    const created = nextName.trim();
    setCreating(true);
    const outcome = await act(async () => {
      if (war) {
        const data = new FormData();
        data.append('file', war);
        return api(`/applications/${encodeURIComponent(created)}`, { method: 'PUT', body: data });
      }
      return api(`/applications/${encodeURIComponent(created)}`, { method: 'POST', body: '{}' });
    }, { ok: war ? 'Application uploaded.' : 'Application created.', fail: 'The application was not created.' });
    setCreating(false);
    if (!outcome.ok) return;
    setNextName('');
    setWar(null);
    setAdding(false);
    await load();
    router.push(`/applications/?name=${encodeURIComponent(created)}`);
  }

  async function remove(app: string) {
    if (!window.confirm(`Delete ${app}?`)) return;
    const outcome = await act(
      () => api(`/applications/${encodeURIComponent(app)}`, { method: 'DELETE' }),
      { ok: `${app} deleted.`, fail: `${app} was not deleted.` }
    );
    if (!outcome.ok) return;
    setApps((current) => current.filter((item) => item !== app));
    if (name === app) router.push('/applications/');
    load();
  }

  return (
    <div>
      <PageTitle kicker='Media' title={name || 'Applications'} />
      {error ? <p className='text-destructive mb-4 text-sm'>{error}</p> : null}
      <div className='grid items-start gap-8 lg:grid-cols-[200px_minmax(0,1fr)]'>
        <aside>
          <div className='mb-2 flex items-center justify-between px-2'>
            <p className='text-muted-foreground font-mono text-[11px] tracking-wide uppercase'>Apps</p>
            <Button type='button' size='sm' variant='outline' className='h-7 px-2' onClick={() => setAdding(true)}>
              <Icons.add />
              New
            </Button>
          </div>
          <nav className='flex flex-col gap-0.5'>
            {apps.map((app) => (
              <div key={app} className={cn('group flex items-center rounded-md', app === name && 'bg-muted')}>
                <button
                  type='button'
                  className='min-w-0 flex-1 truncate px-2.5 py-2 text-left text-sm'
                  onClick={() => router.push(`/applications/?name=${encodeURIComponent(app)}`)}
                >
                  {app}
                </button>
                <button
                  type='button'
                  className={cn('text-muted-foreground hover:text-destructive inline-flex items-center px-2 text-xs opacity-0 group-hover:opacity-100 focus:opacity-100', app === name && 'opacity-100')}
                  onClick={() => remove(app)}
                  aria-label={`Delete ${app}`}
                >
                  <Icons.trash className='size-3.5' />
                </button>
              </div>
            ))}
            {apps.length === 0 ? <p className='text-muted-foreground px-2.5 py-3 text-sm'>No applications yet.</p> : null}
          </nav>
        </aside>
        <div className='min-w-0'>
          {name ? (
            <StreamsView appName={name} />
          ) : apps.length > 0 ? (
            <p className='text-muted-foreground pt-2 text-sm'>Opening {apps[0]}…</p>
          ) : (
            <p className='text-muted-foreground pt-2 text-sm'>{loaded ? 'No applications yet. Create one to get started.' : 'Loading applications…'}</p>
          )}
        </div>
      </div>
      <Dialog open={adding} onOpenChange={(open) => { if (!open) closeCreate(); }}>
          <DialogContent className='sm:max-w-md'>
            <form onSubmit={createApp} className='flex flex-col gap-4'>
              <DialogHeader>
                <DialogTitle className='font-[family-name:var(--font-display)] text-2xl leading-none font-bold tracking-normal uppercase'>New application</DialogTitle>
                <DialogDescription>Create a blank application, or install one from a WAR file.</DialogDescription>
              </DialogHeader>
              <Field label='Name'>
                <Input required autoFocus value={nextName} onChange={(event) => setNextName(event.target.value)} placeholder='LiveApp' />
              </Field>
              <div className='flex flex-col gap-1.5 text-sm'>
                <span className='text-muted-foreground'>WAR file, optional</span>
                <label className='border-border hover:bg-muted/40 flex cursor-pointer items-center gap-3 rounded-md border border-dashed px-3 py-3'>
                  <Icons.upload className='text-muted-foreground size-4 shrink-0' />
                  <span className='min-w-0 flex-1'>
                    <span className='block truncate'>{war ? war.name : 'Choose a .war file'}</span>
                    <span className='text-muted-foreground block text-xs'>{war ? 'This file is installed as the application.' : 'Leave this empty to create a blank application.'}</span>
                  </span>
                  <input key={war ? war.name : 'empty'} type='file' accept='.war,application/java-archive' className='sr-only' onChange={(event) => setWar(event.target.files?.[0] || null)} />
                </label>
                {war ? (
                  <button type='button' className='text-muted-foreground hover:text-foreground self-start text-xs' onClick={() => setWar(null)}>
                    Remove file
                  </button>
                ) : null}
              </div>
              <DialogFooter>
                <Button type='button' variant='outline' disabled={creating} onClick={closeCreate}>Cancel</Button>
                <Button type='submit' disabled={creating}>{creating ? 'Creating…' : war ? 'Upload' : 'Create'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
      </Dialog>
    </div>
  );
}

export function ApplicationsView() {
  return (
    <Suspense fallback={<p className='text-muted-foreground text-sm'>Loading applications…</p>}>
      <ApplicationsBody />
    </Suspense>
  );
}
