'use client';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { api, rowsOf } from '@/lib/api';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { act } from './feedback';
import { Metric, Notice, PageTitle, Panel } from './shell';

type Resources = {
  cpuUsage?: { systemCPULoad?: number; processCPULoad?: number };
  totalLiveStreamSize?: number;
  dbAverageQueryTimeMs?: number;
  systemMemoryInfo?: { totalMemory?: number; inUseMemory?: number; availableMemory?: number };
  fileSystemInfo?: { inUseSpace?: number; totalSpace?: number };
  jvmMemoryUsage?: { inUseMemory?: number; maxMemory?: number };
  gpuUsageInfo?: { gpuUtilization?: number; name?: string }[];
  version?: string;
};

function pct(part?: number, total?: number) {
  if (!part || !total) return 0;
  return Math.round((part / total) * 100);
}

function gb(bytes?: number) {
  if (!bytes) return '0';
  return (bytes / 1024 / 1024 / 1024).toFixed(1);
}

function load(value?: number) {
  if (value == null || Number.isNaN(value)) return '—';
  const shown = value <= 1 ? value * 100 : value;
  return `${Math.round(shown)}%`;
}

export function DashboardView() {
  const [resources, setResources] = useState<Resources | null>(null);
  const [apps, setApps] = useState<Record<string, unknown>[]>([]);
  const [version, setVersion] = useState('');
  const [license, setLicense] = useState<{ type: string; end: string; days: string } | null>(null);
  const [shutdown, setShutdown] = useState(false);
  const [error, setError] = useState('');

  async function loadAll() {
    try {
      const [system, info, ver, licence] = await Promise.all([
        api<Resources>('/system-resources'),
        api<unknown>('/applications-info'),
        api<Record<string, unknown>>('/version').catch(() => ({}) as Record<string, unknown>),
        api<Record<string, unknown>>('/last-licence-status').catch(() => ({}) as Record<string, unknown>)
      ]);
      setResources(system);
      setApps(rowsOf(info));
      setVersion(String(ver.versionName || ver.version || ''));
      const endValue = licence.endDate;
      const parsedEnd = typeof endValue === 'number' ? endValue : Date.parse(String(endValue || ''));
      const endTime = parsedEnd > 0 && parsedEnd < 1e12 ? parsedEnd * 1000 : parsedEnd;
      const days = endTime && !Number.isNaN(endTime) ? Math.ceil((endTime - Date.now()) / 86400000) : null;
      setLicense({
        type: String(licence.type || licence.status || ''),
        end: endTime && !Number.isNaN(endTime) ? new Date(endTime).toLocaleDateString() : '',
        days: days == null ? '' : String(days)
      });
      const names = rowsOf(info).map((app) => String(app.name || app.appName || '')).filter(Boolean).join(',');
      if (names) {
        const closed = await api<{ success?: boolean }>(`/shutdown-proper-status?appNames=${encodeURIComponent(names)}`).catch(() => ({ success: true }));
        setShutdown(closed?.success === false);
      }
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The server did not return system status.');
    }
  }

  useEffect(() => {
    loadAll();
    const timer = window.setInterval(loadAll, 8000);
    return () => window.clearInterval(timer);
  }, []);

  const memory = resources?.systemMemoryInfo;
  const usedMemory =
    memory?.availableMemory && memory.totalMemory && memory.totalMemory > memory.availableMemory
      ? memory.totalMemory - memory.availableMemory
      : memory?.inUseMemory;
  const disk = resources?.fileSystemInfo;
  const heap = resources?.jvmMemoryUsage;

  return (
    <div>
      <PageTitle
        kicker='Server'
        title=''
        action={
          <Button variant='outline' onClick={loadAll}>
            <Icons.refresh /> Refresh
          </Button>
        }
      />
      {error ? <div className='mb-4'><Notice tone='bad'>{error}</Notice></div> : null}
      {shutdown ? (
        <div className='mb-4'>
          <Notice
            tone='warn'
            action={
              <Button
                variant='outline'
                onClick={async () => {
                  const names = apps.map((app) => String(app.name || app.appName || '')).filter(Boolean).join(',');
                  const outcome = await act(
                    () => api(`/shutdown-properly?appNames=${encodeURIComponent(names)}`),
                    { ok: 'Shutdown marked as clean.', fail: 'The shutdown status was not updated.' }
                  );
                  if (outcome.ok) setShutdown(false);
                }}
              >
                Mark resolved
              </Button>
            }
          >
            <span className='block font-medium'>Unclean shutdown</span>
            <span className='text-muted-foreground'>The last shutdown was not clean. Review the logs, then mark this server as shut down properly.</span>
          </Notice>
        </div>
      ) : null}
      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
        <Metric label='System CPU' value={load(resources?.cpuUsage?.systemCPULoad)} />
        <Metric label='Vasl CPU' value={load(resources?.cpuUsage?.processCPULoad)} />
        <Metric label='Live streams' value={String(resources?.totalLiveStreamSize ?? '—')} />
        <Metric label='DB query' value={resources?.dbAverageQueryTimeMs != null ? `${Math.round(resources.dbAverageQueryTimeMs)} ms` : '—'} />
        <Metric label='Memory' value={`${pct(usedMemory, memory?.totalMemory)}%`} hint={`${gb(usedMemory)} / ${gb(memory?.totalMemory)} GB`} />
        <Metric label='Disk' value={`${pct(disk?.inUseSpace, disk?.totalSpace)}%`} hint={`${gb(disk?.inUseSpace)} / ${gb(disk?.totalSpace)} GB`} />
        <Metric label='JVM heap' value={`${pct(heap?.inUseMemory, heap?.maxMemory)}%`} hint={`${gb(heap?.inUseMemory)} / ${gb(heap?.maxMemory)} GB`} />
        <Metric label='Build' value={version || '—'} hint={license?.type ? `${license.type}${license.end ? ` until ${license.end}` : ''}${license.days ? ` · ${license.days} days` : ''}` : 'No license reported'} />
      </div>
      {resources?.gpuUsageInfo?.length ? (
        <div className='mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
          {resources.gpuUsageInfo.map((gpu, index) => (
            <Metric key={gpu.name || index} label={gpu.name || `GPU ${index + 1}`} value={load(gpu.gpuUtilization)} />
          ))}
        </div>
      ) : null}
      <Panel className='mt-6 overflow-hidden'>
        <div className='border-border flex items-center justify-between border-b px-4 py-3'>
          <h2 className='text-sm font-medium'>Applications</h2>
          <Link href='/applications/' className='text-primary text-sm'>
            Manage
          </Link>
        </div>
        <table className='w-full text-sm'>
          <thead className='text-muted-foreground text-left font-mono text-[11px] tracking-wide uppercase'>
            <tr>
              <th className='px-4 py-2 font-normal'>Name</th>
              <th className='px-4 py-2 font-normal'>Live</th>
              <th className='px-4 py-2 font-normal'>VoD</th>
              <th className='px-4 py-2 font-normal'>Storage</th>
            </tr>
          </thead>
          <tbody>
            {apps.map((app) => {
              const name = String(app.name || app.appName || '');
              return (
                <tr key={name} className='border-border border-t'>
                  <td className='px-4 py-2.5'>
                    <Link href={`/applications/?name=${encodeURIComponent(name)}`} className='hover:text-primary'>
                      {name}
                    </Link>
                  </td>
                  <td className='px-4 py-2.5 tabular-nums'>{String(app.liveStreamCount ?? app.liveStreams ?? '—')}</td>
                  <td className='px-4 py-2.5 tabular-nums'>{String(app.vodCount ?? '—')}</td>
                  <td className='px-4 py-2.5 tabular-nums'>{app.storage != null ? gb(Number(app.storage)) + ' GB' : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {apps.length === 0 ? <p className='text-muted-foreground px-4 py-6 text-sm'>No application stats yet.</p> : null}
      </Panel>
    </div>
  );
}
