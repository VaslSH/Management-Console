'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Icons } from '@/components/icons';
import { api, appRequest, mediaOrigin, rowsOf } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useCallback, useEffect, useState } from 'react';
import { act, assertOk, copyText } from './feedback';
import { appSettingGroups, isRecord, RecordEditor } from './record-editor';
import { Empty, Field, Panel } from './shell';

type Row = Record<string, unknown>;

const selectClass = 'border-input h-8 rounded-lg border bg-transparent px-2 text-sm';

function text(value: unknown) {
  if (value == null || value === '') return '—';
  return String(value);
}

function streamTitle(value: unknown) {
  const name = value == null ? '' : String(value).trim();
  return name || '[ No Name ]';
}

function countOf(data: unknown) {
  if (typeof data === 'number') return data;
  if (isRecord(data)) {
    const value = data.number ?? data.count ?? data.total;
    if (typeof value === 'number') return value;
  }
  return rowsOf(data).length;
}

function bytes(value: unknown) {
  const size = Number(value);
  if (!size) return '—';
  if (size > 1024 * 1024 * 1024) return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (size > 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.round(size / 1024)} KB`;
}

function when(value: unknown) {
  const time = typeof value === 'number' ? value : Date.parse(String(value || ''));
  if (!time || Number.isNaN(time)) return '—';
  return new Date(time).toLocaleString();
}

function tokenId(data: unknown) {
  if (!isRecord(data)) return '';
  return String(data.tokenId || data.token || data.message || '');
}

function RecordTable({ data }: { data: unknown }) {
  if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
    return <p className='text-sm break-all'>{String(data)}</p>;
  }
  const rows = rowsOf(data);
  const list = rows.length ? rows : isRecord(data) ? [data] : [];
  if (!list.length) return <p className='text-muted-foreground text-sm'>Nothing returned.</p>;
  const columns = Array.from(new Set(list.flatMap((row) => Object.keys(row)))).slice(0, 8);
  return (
    <div className='overflow-x-auto'>
      <table className='w-full text-left text-sm'>
        <thead className='text-muted-foreground font-mono text-[11px] tracking-wide uppercase'>
          <tr>
            {columns.map((column) => (
              <th key={column} className='px-2 py-1 font-normal'>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {list.map((row, index) => (
            <tr key={index} className='border-border border-t'>
              {columns.map((column) => (
                <td key={column} className='max-w-48 truncate px-2 py-1.5'>
                  {text(isRecord(row[column]) || Array.isArray(row[column]) ? JSON.stringify(row[column]) : row[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const typeLabel: Record<string, string> = {
  liveStream: 'Live',
  ipCamera: 'Camera',
  streamSource: 'Source',
  playlist: 'Playlist',
  VoD: 'VoD'
};

const typeIcon = {
  liveStream: Icons.broadcast,
  ipCamera: Icons.cctv,
  streamSource: Icons.antenna,
  playlist: Icons.playlist,
  VoD: Icons.movie,
  streamVod: Icons.movie,
  uploadedVod: Icons.upload,
  userVod: Icons.user
} as const;

function TypeMark({ type }: { type: string }) {
  const Icon = typeIcon[type as keyof typeof typeIcon] || Icons.video;
  return <Icon className='text-muted-foreground size-4 shrink-0' aria-hidden />;
}

function amount(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function streamHealth(row: Row) {
  const status = String(row.status || '');
  if (status === 'preparing') return { label: 'Preparing', tone: 'warn' as const, speed: 0, detail: 'The stream is preparing.' };
  if (status === 'terminated_unexpectedly') return { label: 'Offline', tone: 'bad' as const, speed: 0, detail: 'Terminated unexpectedly.' };
  if (status !== 'broadcasting') return { label: 'Offline', tone: 'idle' as const, speed: 0, detail: '' };

  const loss = amount(row.packetLostRatio);
  const rtt = amount(row.rttMs);
  const jitter = amount(row.jitterMs);
  const pending = amount(row.pendingPacketSize);
  const encoder = amount(row.encoderQueueSize);
  const speed = amount(row.speed);
  const notes: string[] = [];
  if (loss > 0.01) notes.push('Packet loss is above 1%. The publisher network is the likely cause.');
  if (rtt > 100) notes.push('Round trip is above 100 ms.');
  if (jitter > 50) notes.push('Jitter is above 50 ms.');
  if (pending > 15) notes.push('The input queue is above 15. The server is falling behind.');
  if (encoder > 15) notes.push('The encoder queue is above 15. CPU or GPU is falling behind.');
  if (speed > 0 && speed < 0.7) notes.push('Speed is below 0.7x. It should stay near 1.0x.');
  const strained = loss > 0.02 || rtt > 100 || jitter > 50 || pending > 15 || encoder > 15 || (speed > 0 && speed < 0.7);
  const stats: string[] = [];
  if (amount(row.width) > 0 && amount(row.height) > 0) stats.push(`${row.width}×${row.height}`);
  if (amount(row.bitrate) > 0) stats.push(`${Math.floor(amount(row.bitrate) / 1000)} kbps`);
  if (speed > 0) stats.push(`${speed.toFixed(2)}x`);
  if (rtt > 0) stats.push(`RTT ${Math.round(rtt)} ms`);
  if (jitter > 0) stats.push(`Jitter ${Math.round(jitter)} ms`);
  if (amount(row.packetsLost) > 0) stats.push(`${row.packetsLost} packets lost`);
  const detail = [...(notes.length ? ['This stream is under strain.', ...notes, ''] : []), ...stats].filter(Boolean).join('\n');
  return { label: 'Broadcasting', tone: strained ? ('warn' as const) : ('good' as const), speed, detail };
}

const healthTone = {
  good: 'bg-primary',
  warn: 'bg-chart-2',
  bad: 'bg-destructive',
  idle: 'bg-muted-foreground/40'
};

function viewersOf(row: Row) {
  return [
    ['HLS', row.hlsViewerCount],
    ['DASH', row.dashViewerCount],
    ['WebRTC', row.webRTCViewerCount],
    ['RTMP', row.rtmpViewerCount]
  ].filter(([, count]) => Number(count) > 0);
}

function StreamStatus({ row }: { row: Row }) {
  const health = streamHealth(row);
  return (
    <div className='flex items-center gap-2' title={health.detail || undefined}>
      <span className={cn('size-2 shrink-0 rounded-full', healthTone[health.tone])} />
      <span>{health.label}</span>
      {health.speed > 0 ? <span className='text-muted-foreground font-mono text-xs'>{health.speed.toFixed(2)}x</span> : null}
    </div>
  );
}

function StreamMenu({
  row,
  appName,
  origin,
  onEdit,
  onPlay,
  onInspect,
  onChanged,
  onDelete
}: {
  row: Row;
  appName: string;
  origin: string;
  onEdit: () => void;
  onPlay: (protocol: 'webrtc' | 'hls', multitrack: boolean) => void;
  onInspect: (title: string, path: string) => void;
  onChanged: () => void;
  onDelete: () => void;
}) {
  const id = String(row.streamId || '');
  const subtracks = Array.isArray(row.subTrackStreamIds) ? row.subTrackStreamIds : [];
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger render={<Button variant='ghost' size='icon-sm' aria-label='Stream actions' />}>
        <Icons.ellipsis />
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='min-w-44'>
        <DropdownMenuItem onClick={onEdit}><Icons.edit /> Edit</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPlay('hls', false)}><Icons.play /> Play HLS</DropdownMenuItem>
        <DropdownMenuItem onClick={() => copyText(`rtmp://${window.location.hostname}/${appName}/${id}`)}><Icons.copy /> Copy RTMP</DropdownMenuItem>
        <DropdownMenuItem onClick={() => copyText(`<iframe width="560" height="315" src="${origin}/${appName}/play.html?id=${id}" allowfullscreen></iframe>`)}><Icons.code /> Copy embed</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => act(() => api(appRequest(appName, `broadcasts/${id}/recording/${!row.mp4Enabled}&recordType=mp4`), { method: 'PUT' }), { ok: row.mp4Enabled ? 'MP4 recording stopped.' : 'MP4 recording started.', fail: 'Recording was not changed.' }).then((outcome) => { if (outcome.ok) onChanged(); })}>
          <Icons.media /> {row.mp4Enabled ? 'Stop MP4' : 'Record MP4'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => act(() => api(appRequest(appName, `broadcasts/${id}/recording/${!row.webMEnabled}&recordType=webm`), { method: 'PUT' }), { ok: row.webMEnabled ? 'WebM recording stopped.' : 'WebM recording started.', fail: 'Recording was not changed.' }).then((outcome) => { if (outcome.ok) onChanged(); })}>
          <Icons.media /> {row.webMEnabled ? 'Stop WebM' : 'Record WebM'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onInspect('Statistics', `broadcasts/${id}/broadcast-statistics`)}><Icons.adjustments /> Statistics</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onInspect('WebRTC clients', `broadcasts/${id}/webrtc-client-stats/0/20`)}><Icons.teams /> WebRTC clients</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onInspect('Detections', `broadcasts/${id}/detections/0/20`)}><Icons.search /> Detections</DropdownMenuItem>
        {row.type === 'ipCamera' ? (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger><Icons.video /> Camera</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => onInspect('Camera error', `broadcasts/${row.ipAddr || id}/ip-camera-error`)}>Error</DropdownMenuItem>
              {(['left', 'right', 'up', 'down'] as const).map((direction) => (
                <DropdownMenuItem key={direction} onClick={() => act(() => api(appRequest(appName, `broadcasts/${id}/ip-camera/move-${direction}`), { method: 'POST', body: '{}' }), { ok: `Camera moved ${direction}.`, fail: 'The camera did not move.' })}>
                  Move {direction}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ) : null}
        {subtracks.length > 0 ? <DropdownMenuItem onClick={() => onPlay('webrtc', true)}><Icons.broadcast /> Multitrack player</DropdownMenuItem> : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant='destructive' onClick={onDelete}><Icons.trash /> Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Pager({
  page,
  pages,
  size,
  onPage,
  onSize
}: {
  page: number;
  pages: number;
  size: number;
  onPage: (page: number) => void;
  onSize: (size: number) => void;
}) {
  return (
    <div className='text-muted-foreground flex items-center justify-end gap-2 text-sm'>
      <Button type='button' size='sm' variant='outline' disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <Icons.chevronLeft /> Previous
      </Button>
      <span>
        {page} / {pages}
      </span>
      <Button type='button' size='sm' variant='outline' disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next <Icons.chevronRight />
      </Button>
      <select className={selectClass} value={size} onChange={(event) => onSize(Number(event.target.value))}>
        {[10, 20, 50].map((option) => (
          <option key={option} value={option}>
            {option} / page
          </option>
        ))}
      </select>
    </div>
  );
}

export function StreamsView({ appName }: { appName: string }) {
  const [tab, setTab] = useState<'live' | 'vod' | 'settings' | 'social'>('live');
  const [streams, setStreams] = useState<Row[]>([]);
  const [vods, setVods] = useState<Row[]>([]);
  const [settings, setSettings] = useState<Row | null>(null);
  const [social, setSocial] = useState<Row[]>([]);
  const [error, setError] = useState('');
  const [detailTitle, setDetailTitle] = useState('');
  const [detail, setDetail] = useState<unknown>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [vodSelected, setVodSelected] = useState<string[]>([]);
  const [query, setQuery] = useState({ q: '', sort: 'date', order: 'desc', page: 1, size: 20 });
  const [vodQuery, setVodQuery] = useState({ q: '', sort: 'date', order: 'desc', page: 1, size: 20 });
  const [totals, setTotals] = useState({ live: 0, vod: 0 });
  const [form, setForm] = useState({
    name: '',
    streamId: '',
    type: 'liveStream',
    streamUrl: '',
    ipAddr: '',
    username: '',
    password: '',
    playlist: '',
    socialNetworks: ''
  });
  const [editForm, setEditForm] = useState(form);
  const [restream, setRestream] = useState('');
  const [socialForm, setSocialForm] = useState({ network: 'facebook', serviceId: '', streamId: '', channelType: 'channel', channel: '' });
  const [comments, setComments] = useState<Row[]>([]);
  const [player, setPlayer] = useState<{ id: string; title: string; protocol: 'webrtc' | 'hls' | 'vod'; multitrack: boolean; token: string } | null>(null);

  const origin = mediaOrigin();

  function listPath(kind: 'broadcasts' | 'vods', state: typeof query) {
    const offset = (state.page - 1) * state.size;
    const search = state.q.trim();
    return `${kind}/list/${offset}/${state.size}&sort_by=${state.sort}&order_by=${state.order}${search ? `&search=${encodeURIComponent(search)}` : ''}`;
  }

  const refresh = useCallback(async () => {
    try {
      const search = query.q.trim();
      const vodSearch = vodQuery.q.trim();
      const [live, liveCount, vod, vodCount, appSettings, endpoints] = await Promise.all([
        api(appRequest(appName, listPath('broadcasts', query))),
        api(appRequest(appName, search ? `broadcasts/count/${encodeURIComponent(search)}` : 'broadcasts/count')).catch(() => null),
        api(appRequest(appName, listPath('vods', vodQuery))).catch(() => []),
        api(appRequest(appName, vodSearch ? `vods/count/${encodeURIComponent(vodSearch)}` : 'vods/count')).catch(() => null),
        api<Row>(`/applications/settings/${appName}`).catch(() => null),
        api(appRequest(appName, 'broadcasts/social-endpoints/0/20')).catch(() => [])
      ]);
      setStreams(rowsOf(live));
      setVods(rowsOf(vod));
      setTotals({ live: countOf(liveCount), vod: countOf(vodCount) });
      setSettings((current) => (tab === 'settings' && current ? current : appSettings && isRecord(appSettings) ? appSettings : current));
      setSocial(rowsOf(endpoints));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this application.');
    }
  }, [appName, query, vodQuery, tab]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 8000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  function playerSrc(current: NonNullable<typeof player>) {
    const base = current.multitrack
      ? `${origin}/multitrack-play.html?id=${encodeURIComponent(current.id)}&app=${encodeURIComponent(appName)}`
      : `${origin}/${appName}/play.html?${current.protocol === 'vod' ? 'name' : 'id'}=${encodeURIComponent(current.id)}&playOrder=${current.protocol}`;
    return current.token ? `${base}&token=${encodeURIComponent(current.token)}` : base;
  }

  async function play(id: string, protocol: 'webrtc' | 'hls' | 'vod', multitrack: boolean, title = id) {
    let token = '';
    const needsToken = Boolean(settings?.playTokenControlEnabled || settings?.enableTimeTokenForPlay || settings?.playJwtControlEnabled);
    if (needsToken && id) {
      const path = settings?.playJwtControlEnabled ? 'jwt-token' : 'token';
      const outcome = await act(
        () => api(appRequest(appName, `broadcasts/${id}/${path}&expireDate=${Date.now() + 3600000}&type=play`)),
        { fail: 'A play token could not be issued.' }
      );
      if (!outcome.ok) return;
      token = tokenId(outcome.result);
    }
    setPlayer({ id, title, protocol, multitrack, token });
  }

  async function createStream(event: React.FormEvent) {
    event.preventDefault();
    const body: Row = { name: form.name, streamId: form.streamId || undefined, type: form.type };
    if (form.type === 'ipCamera') {
      body.ipAddr = form.ipAddr;
      body.username = form.username;
      body.password = form.password;
    }
    if (form.type === 'streamSource') body.streamUrl = form.streamUrl;
    if (form.type === 'playlist') {
      body.playListItemList = form.playlist
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((streamUrl) => ({ streamUrl, type: 'VoD' }));
      body.playlistLoopEnabled = true;
    }
    const networks = form.socialNetworks.trim();
    const outcome = await act(
      () => api(appRequest(appName, `broadcasts/create&autoStart=${form.type === 'ipCamera' || form.type === 'streamSource'}&socialNetworks=${encodeURIComponent(networks)}`), {
        method: 'POST',
        body: JSON.stringify(body)
      }),
      { ok: 'Stream created.', fail: 'The stream was not created.' }
    );
    if (!outcome.ok) return;
    setCreating(false);
    setForm({ name: '', streamId: '', type: 'liveStream', streamUrl: '', ipAddr: '', username: '', password: '', playlist: '', socialNetworks: '' });
    refresh();
  }

  function openEdit(row: Row) {
    const items = Array.isArray(row.playListItemList) ? row.playListItemList : [];
    setEditing(row);
    setEditForm({
      name: String(row.name || ''),
      streamId: String(row.streamId || ''),
      type: String(row.type || 'liveStream'),
      streamUrl: String(row.streamUrl || ''),
      ipAddr: String(row.ipAddr || ''),
      username: String(row.username || ''),
      password: '',
      playlist: items.map((item) => (isRecord(item) ? String(item.streamUrl || '') : '')).filter(Boolean).join('\n'),
      socialNetworks: ''
    });
    setRestream('');
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const body: Row = { ...editing, name: editForm.name, streamId: editForm.streamId, type: editForm.type };
    if (editForm.type === 'ipCamera') {
      body.ipAddr = editForm.ipAddr;
      body.username = editForm.username;
      if (editForm.password) body.password = editForm.password;
    }
    if (editForm.type === 'streamSource') body.streamUrl = editForm.streamUrl;
    if (editForm.type === 'playlist') {
      body.playListItemList = editForm.playlist
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((streamUrl) => ({ streamUrl, type: 'VoD' }));
    }
    const networks = editForm.socialNetworks.trim();
    const outcome = await act(
      () => api(appRequest(appName, `broadcasts/${editForm.streamId}&socialNetworks=${encodeURIComponent(networks)}`), {
        method: 'PUT',
        body: JSON.stringify(body)
      }),
      { ok: 'Stream saved.', fail: 'The stream was not saved.' }
    );
    if (!outcome.ok) return;
    setEditing(null);
    refresh();
  }

  async function removeSelected(kind: 'broadcasts' | 'vods', ids: string[]) {
    if (!ids.length || !window.confirm(`Delete ${ids.length} item${ids.length === 1 ? '' : 's'}?`)) return;
    const outcome = await act(
      () => api(appRequest(appName, `${kind}/&ids=${ids.map(encodeURIComponent).join(',')}`), { method: 'DELETE' }),
      { ok: ids.length === 1 ? 'Deleted.' : `${ids.length} deleted.`, fail: 'Nothing was deleted.' }
    );
    if (!outcome.ok) return;
    if (kind === 'broadcasts') setSelected([]);
    else setVodSelected([]);
    refresh();
  }

  async function show(title: string, path: string) {
    const outcome = await act(() => api(appRequest(appName, path)), { fail: `${title} could not be loaded.` });
    if (!outcome.ok) return;
    setDetailTitle(title);
    setDetail(outcome.result);
  }

  async function connectSocial(event: React.FormEvent) {
    event.preventDefault();
    const outcome = await act(
      () => api(appRequest(appName, `broadcasts/social-networks/${socialForm.network}`), { method: 'POST', body: '{}' }),
      { ok: 'Device authorization started.', fail: 'Device authorization did not start.' }
    );
    if (!outcome.ok) return;
    setDetailTitle(`${socialForm.network} device authorization`);
    setDetail(outcome.result);
  }

  async function loadComments() {
    if (!socialForm.streamId || !socialForm.serviceId) return;
    const outcome = await act(async () => {
      const [list, interaction, views] = await Promise.all([
        api(appRequest(appName, `broadcasts/${socialForm.streamId}/social-endpoints/${socialForm.serviceId}/live-comments/0/20`)),
        api(appRequest(appName, `broadcasts/${socialForm.streamId}/social-endpoints/${socialForm.serviceId}/interaction`)).catch(() => null),
        api(appRequest(appName, `broadcasts/${socialForm.streamId}/social-endpoints/${socialForm.serviceId}/live-views-count`)).catch(() => null)
      ]);
      return { list, interaction, views };
    }, { fail: 'Comments could not be loaded.' });
    if (!outcome.ok) return;
    const { list, interaction, views } = outcome.result;
    setComments(rowsOf(list));
    setDetailTitle('Social activity');
    setDetail({ interaction, views });
  }

  const livePages = Math.max(1, Math.ceil(totals.live / query.size));
  const vodPages = Math.max(1, Math.ceil(totals.vod / vodQuery.size));

  const sections = [
    ['live', 'Live', Icons.broadcast],
    ['vod', 'VoD', Icons.media],
    ['settings', 'Settings', Icons.settings],
    ['social', 'Social', Icons.share]
  ] as const;

  return (
    <div>
      <div className='border-border mb-5 flex gap-1 border-b' role='tablist'>
        {sections.map(([value, label, Icon]) => (
          <button
            key={value}
            type='button'
            role='tab'
            aria-selected={tab === value}
            className={cn(
              '-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm',
              tab === value ? 'border-primary text-foreground' : 'text-muted-foreground hover:text-foreground border-transparent'
            )}
            onClick={() => setTab(value)}
          >
            <Icon className='size-4' />
            {label}
          </button>
        ))}
      </div>
      {error ? <p className='text-destructive mb-3 text-sm'>{error}</p> : null}

      {tab === 'live' ? (
        <div className='flex flex-col gap-4'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <form
              className='flex min-w-0 flex-1 items-center gap-2'
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                setQuery((current) => ({ ...current, q: String(data.get('q') || ''), page: 1 }));
              }}
            >
              <div className='relative max-w-xs flex-1'>
                <Icons.search className='text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2' />
                <Input name='q' defaultValue={query.q} placeholder='Search streams' className='pl-8' aria-label='Search streams' />
              </div>
              <select
                aria-label='Sort streams'
                className={selectClass}
                value={`${query.sort}:${query.order}`}
                onChange={(event) => {
                  const [sort, order] = event.target.value.split(':');
                  setQuery((current) => ({ ...current, sort, order, page: 1 }));
                }}
              >
                <option value='date:desc'>Newest</option>
                <option value='date:asc'>Oldest</option>
                <option value='name:asc'>Name</option>
                <option value='status:asc'>Status</option>
              </select>
            </form>
            <div className='flex items-center gap-2'>
              {selected.length > 0 ? (
                <Button type='button' size='sm' variant='destructive' onClick={() => removeSelected('broadcasts', selected)}>
                  <Icons.trash /> Delete {selected.length}
                </Button>
              ) : null}
              <Button type='button' size='sm' onClick={() => setCreating((value) => !value)}>
                {creating ? <Icons.close /> : <Icons.add />}
                {creating ? 'Close' : 'New stream'}
              </Button>
            </div>
          </div>

          {creating ? (
            <Panel className='p-4'>
              <form className='grid gap-3 md:grid-cols-2' onSubmit={createStream}>
                <Field label='Name'><Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
                <Field label='Stream id'><Input value={form.streamId} onChange={(event) => setForm({ ...form, streamId: event.target.value })} /></Field>
                <Field label='Type'>
                  <select className={selectClass} value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
                    <option value='liveStream'>Live broadcast</option>
                    <option value='ipCamera'>IP camera</option>
                    <option value='streamSource'>Stream source</option>
                    <option value='playlist'>Playlist</option>
                  </select>
                </Field>
                <Field label='Social networks'><Input value={form.socialNetworks} onChange={(event) => setForm({ ...form, socialNetworks: event.target.value })} placeholder='facebook,youtube' /></Field>
                {form.type === 'ipCamera' ? (
                  <>
                    <Field label='Camera URL'><Input required value={form.ipAddr} onChange={(event) => setForm({ ...form, ipAddr: event.target.value })} /></Field>
                    <Field label='Username'><Input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} /></Field>
                    <Field label='Password'><Input type='password' value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></Field>
                  </>
                ) : null}
                {form.type === 'streamSource' ? <Field label='Source URL'><Input required value={form.streamUrl} onChange={(event) => setForm({ ...form, streamUrl: event.target.value })} /></Field> : null}
                {form.type === 'playlist' ? (
                  <label className='flex flex-col gap-1.5 text-sm md:col-span-2'>
                    <span className='text-muted-foreground'>Playlist URLs, one per line</span>
                    <textarea className='border-input min-h-24 rounded-lg border bg-transparent px-2.5 py-2 text-sm' value={form.playlist} onChange={(event) => setForm({ ...form, playlist: event.target.value })} />
                  </label>
                ) : null}
                <div><Button type='submit'>Create</Button></div>
              </form>
            </Panel>
          ) : null}

          {editing ? (
            <Panel className='p-4'>
              <form className='grid gap-3 md:grid-cols-2' onSubmit={saveEdit}>
                <Field label='Name'><Input required value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} /></Field>
                <Field label='Stream id'><Input required value={editForm.streamId} onChange={(event) => setEditForm({ ...editForm, streamId: event.target.value })} /></Field>
                {editForm.type === 'ipCamera' ? (
                  <>
                    <Field label='Camera URL'><Input value={editForm.ipAddr} onChange={(event) => setEditForm({ ...editForm, ipAddr: event.target.value })} /></Field>
                    <Field label='Username'><Input value={editForm.username} onChange={(event) => setEditForm({ ...editForm, username: event.target.value })} /></Field>
                    <Field label='New password'><Input type='password' value={editForm.password} onChange={(event) => setEditForm({ ...editForm, password: event.target.value })} /></Field>
                  </>
                ) : null}
                {editForm.type === 'streamSource' ? <Field label='Source URL'><Input value={editForm.streamUrl} onChange={(event) => setEditForm({ ...editForm, streamUrl: event.target.value })} /></Field> : null}
                {editForm.type === 'playlist' ? (
                  <label className='flex flex-col gap-1.5 text-sm md:col-span-2'>
                    <span className='text-muted-foreground'>Playlist URLs</span>
                    <textarea className='border-input min-h-24 rounded-lg border bg-transparent px-2.5 py-2 text-sm' value={editForm.playlist} onChange={(event) => setEditForm({ ...editForm, playlist: event.target.value })} />
                  </label>
                ) : null}
                <Field label='Attach social networks'><Input value={editForm.socialNetworks} onChange={(event) => setEditForm({ ...editForm, socialNetworks: event.target.value })} /></Field>
                <div className='flex gap-2'>
                  <Button type='submit'>Save</Button>
                  <Button type='button' variant='outline' onClick={() => setEditing(null)}>Cancel</Button>
                </div>
              </form>
              <form
                className='mt-4 flex flex-wrap items-end gap-2'
                onSubmit={async (event) => {
                  event.preventDefault();
                  await act(
                    () => api(appRequest(appName, `broadcasts/${editForm.streamId}/endpoint`), { method: 'POST', body: JSON.stringify({ endpointUrl: restream }) }),
                    { ok: 'Restream endpoint added.', fail: 'The endpoint was not added.' }
                  ).then(async (outcome) => {
                    if (!outcome.ok) return;
                    setRestream('');
                    const fresh = await api<Row>(appRequest(appName, `broadcasts/${editForm.streamId}`));
                    if (isRecord(fresh)) openEdit(fresh);
                    refresh();
                  });
                }}
              >
                <Field label='Restream URL'><Input required value={restream} onChange={(event) => setRestream(event.target.value)} placeholder='rtmp://...' /></Field>
                <Button type='submit' variant='outline'>Add endpoint</Button>
              </form>
              <div className='mt-3 flex flex-col gap-2'>
                {(Array.isArray(editing.endPointList) ? editing.endPointList : []).map((endpoint) => {
                  if (!isRecord(endpoint)) return null;
                  const serviceId = String(endpoint.endpointServiceId || '');
                  const url = String(endpoint.endpointUrl || endpoint.rtmpUrl || '');
                  return (
                    <div key={serviceId || url} className='flex items-center justify-between gap-3 text-sm'>
                      <span className='truncate'>{url || serviceId}</span>
                      <Button
                        type='button'
                        size='sm'
                        variant='destructive'
                        onClick={async () => {
                          const query = serviceId ? `endpointServiceId=${encodeURIComponent(serviceId)}` : `endpointUrl=${encodeURIComponent(url)}`;
                          const outcome = await act(
                            () => api(appRequest(appName, `broadcasts/${editForm.streamId}/endpoint&${query}`), { method: 'DELETE' }),
                            { ok: 'Restream endpoint removed.', fail: 'The endpoint was not removed.' }
                          );
                          if (!outcome.ok) return;
                          const fresh = await api<Row>(appRequest(appName, `broadcasts/${editForm.streamId}`));
                          if (isRecord(fresh)) openEdit(fresh);
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  );
                })}
              </div>
            </Panel>
          ) : null}

          <Panel className='overflow-hidden'>
            <div className='border-border text-muted-foreground flex items-center justify-between border-b px-4 py-2.5 text-xs'>
              <span>{totals.live || streams.length} streams</span>
              <span>{streams.filter((row) => row.status === 'broadcasting').length} broadcasting</span>
            </div>
            {streams.length === 0 ? <Empty>No streams on this page.</Empty> : (
              <div className='overflow-x-auto'>
              <table className='w-full min-w-[720px] text-left text-sm'>
                <thead className='text-muted-foreground font-mono text-[11px] tracking-wide uppercase'>
                  <tr>
                    <th className='w-8 px-3 py-2 font-normal' />
                    <th className='px-3 py-2 font-normal'>Stream</th>
                    <th className='px-3 py-2 font-normal'>Status</th>
                    <th className='px-3 py-2 font-normal'>Viewers</th>
                    <th className='px-3 py-2 text-right font-normal'>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {streams.map((row) => {
                    const id = String(row.streamId || '');
                    const subtracks = Array.isArray(row.subTrackStreamIds) ? row.subTrackStreamIds : [];
                    const playlist = Array.isArray(row.playListItemList) ? row.playListItemList : [];
                    const duration = playlist.reduce((sum, item) => sum + (isRecord(item) ? Number(item.durationInMs || 0) : 0), 0);
                    const viewers = viewersOf(row);
                    const live = row.status === 'broadcasting';
                    const title = streamTitle(row.name);
                    return (
                      <tr key={id} className={cn('border-border border-t', live && 'bg-primary/5')}>
                        <td className='px-3 py-3'>
                          <input
                            type='checkbox'
                            aria-label={`Select ${title}`}
                            checked={selected.includes(id)}
                            onChange={(event) => setSelected((current) => event.target.checked ? [...current, id] : current.filter((item) => item !== id))}
                          />
                        </td>
                        <td className='max-w-72 px-3 py-3'>
                          <div className='flex items-center gap-2.5'>
                            <TypeMark type={String(row.type || '')} />
                            <div className='min-w-0'>
                              <button type='button' className='block max-w-full truncate text-left font-medium hover:underline' onClick={() => play(id, 'webrtc', subtracks.length > 0, title)}>
                                {title}
                              </button>
                              <p className='text-muted-foreground mt-0.5 truncate font-mono text-xs'>
                                {id} · {typeLabel[String(row.type)] || text(row.type)}
                                {row.type === 'playlist' ? ` · item ${text(row.currentPlayIndex)} · ${Math.round(duration / 1000)}s` : ''}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className='px-3 py-3'>
                          <StreamStatus row={row} />
                        </td>
                        <td className='text-muted-foreground px-3 py-3 text-xs tabular-nums'>
                          {viewers.length ? viewers.map(([label, count]) => `${label} ${count}`).join(' · ') : '—'}
                        </td>
                        <td className='px-3 py-3'>
                          <div className='flex items-center justify-end gap-1'>
                            <Button size='sm' onClick={() => play(id, 'webrtc', subtracks.length > 0, title)}><Icons.play /> Play</Button>
                            <Button size='sm' variant='ghost' onClick={() => act(() => api(appRequest(appName, `broadcasts/${id}/${live ? 'stop' : 'start'}`), { method: 'POST', body: '{}' }), { ok: live ? 'Stream stopped.' : 'Stream started.', fail: live ? 'The stream did not stop.' : 'The stream did not start.' }).then((outcome) => { if (outcome.ok) refresh(); })}>
                              {live ? <Icons.stop /> : <Icons.play />}
                              {live ? 'Stop' : 'Start'}
                            </Button>
                            <StreamMenu
                              row={row}
                              appName={appName}
                              origin={origin}
                              onEdit={() => openEdit(row)}
                              onPlay={(protocol, multitrack) => play(id, protocol, multitrack, title)}
                              onInspect={show}
                              onChanged={refresh}
                              onDelete={() => removeSelected('broadcasts', [id])}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}
          </Panel>
          <Pager page={query.page} pages={livePages} size={query.size} onPage={(page) => setQuery((current) => ({ ...current, page }))} onSize={(size) => setQuery((current) => ({ ...current, size, page: 1 }))} />
        </div>
      ) : null}

      {tab === 'vod' ? (
        <div className='flex flex-col gap-4'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <form
              className='flex min-w-0 flex-1 items-center gap-2'
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                setVodQuery((current) => ({ ...current, q: String(data.get('q') || ''), page: 1 }));
              }}
            >
              <div className='relative max-w-xs flex-1'>
                <Icons.search className='text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2' />
                <Input name='q' defaultValue={vodQuery.q} placeholder='Search recordings' className='pl-8' aria-label='Search recordings' />
              </div>
              <select
                aria-label='Sort recordings'
                className={selectClass}
                value={`${vodQuery.sort}:${vodQuery.order}`}
                onChange={(event) => {
                  const [sort, order] = event.target.value.split(':');
                  setVodQuery((current) => ({ ...current, sort, order, page: 1 }));
                }}
              >
                <option value='date:desc'>Newest</option>
                <option value='date:asc'>Oldest</option>
                <option value='name:asc'>Name</option>
              </select>
            </form>
            <div className='flex items-center gap-2'>
              {vodSelected.length > 0 ? (
                <Button type='button' size='sm' variant='destructive' onClick={() => removeSelected('vods', vodSelected)}>
                  <Icons.trash /> Delete {vodSelected.length}
                </Button>
              ) : null}
              <label className='border-border hover:bg-muted inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-sm'>
                <Icons.upload className='size-4' />
                Upload
                <input
                  type='file'
                  className='sr-only'
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (!file) return;
                    const data = new FormData();
                    data.append('file', file);
                    act(
                      () => api(appRequest(appName, `vods/create&name=${encodeURIComponent(file.name)}`), { method: 'POST', body: data }),
                      { ok: `${file.name} uploaded.`, fail: 'The upload failed.' }
                    ).then((outcome) => { if (outcome.ok) refresh(); });
                  }}
                />
              </label>
            </div>
          </div>
          <Panel className='overflow-x-auto'>
            {vods.length === 0 ? <Empty>No recordings on this page.</Empty> : (
              <table className='w-full text-left text-sm'>
                <thead className='text-muted-foreground font-mono text-[11px] tracking-wide uppercase'>
                  <tr>
                    <th className='px-3 py-2 font-normal' />
                    <th className='px-3 py-2 font-normal'>Name</th>
                    <th className='px-3 py-2 font-normal'>Type</th>
                    <th className='px-3 py-2 font-normal'>Date</th>
                    <th className='px-3 py-2 font-normal'>Stream</th>
                    <th className='px-3 py-2 font-normal'>Size</th>
                    <th className='px-3 py-2 font-normal'>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vods.map((row) => {
                    const id = String(row.vodId || row.streamId || row.filePath || '');
                    const filePath = String(row.filePath || '');
                    const url = filePath ? `${origin}/${appName}/${filePath}` : '';
                    const playId = String(row.streamId || row.vodName || row.filePath || id);
                    return (
                      <tr key={id} className='border-border border-t'>
                        <td className='px-3 py-2'>
                          <input type='checkbox' checked={vodSelected.includes(id)} onChange={(event) => setVodSelected((current) => event.target.checked ? [...current, id] : current.filter((item) => item !== id))} />
                        </td>
                        <td className='px-3 py-2'>
                          <span className='flex items-center gap-2'>
                            <TypeMark type={String(row.type || 'VoD')} />
                            <span className='truncate'>{text(row.vodName || row.filePath)}</span>
                          </span>
                        </td>
                        <td className='px-3 py-2'>{typeLabel[String(row.type)] || text(row.type)}</td>
                        <td className='px-3 py-2'>{when(row.creationDate)}</td>
                        <td className='px-3 py-2 font-mono text-xs'>{text(row.streamId)}</td>
                        <td className='px-3 py-2'>{bytes(row.fileSize)}</td>
                        <td className='px-3 py-2'>
                          <div className='flex items-center justify-end gap-1'>
                            <Button size='sm' onClick={() => play(playId, 'vod', false, text(row.vodName || row.filePath))}><Icons.play /> Play</Button>
                            <DropdownMenu modal={false}>
                              <DropdownMenuTrigger render={<Button variant='ghost' size='icon-sm' aria-label='Recording actions' />}>
                                <Icons.ellipsis />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align='end'>
                                <DropdownMenuItem disabled={!url} onClick={() => copyText(url)}><Icons.copy /> Copy URL</DropdownMenuItem>
                                <DropdownMenuItem disabled={!url} onClick={() => window.open(url, '_blank', 'noopener')}><Icons.download /> Download</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant='destructive' onClick={() => removeSelected('vods', [id])}><Icons.trash /> Delete</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Panel>
          <Pager page={vodQuery.page} pages={vodPages} size={vodQuery.size} onPage={(page) => setVodQuery((current) => ({ ...current, page }))} onSize={(size) => setVodQuery((current) => ({ ...current, size, page: 1 }))} />
        </div>
      ) : null}

      {tab === 'settings' && settings ? (
        <RecordEditor
          key={appName}
          groups={appSettingGroups}
          value={settings}
          onSave={async (next) => {
            assertOk(await api(`/applications/settings/${appName}`, { method: 'POST', body: JSON.stringify(next) }), 'Settings were not saved.');
            setSettings(next);
          }}
        />
      ) : null}
      {tab === 'settings' && !settings ? <Empty>Settings are still loading.</Empty> : null}

      {tab === 'social' ? (
        <div className='grid gap-4 lg:grid-cols-[1fr_320px]'>
          <Panel>
            {social.length === 0 ? <Empty>No connected social endpoints.</Empty> : social.map((row) => {
              const id = String(row.endpointServiceId || row.id || '');
              return (
                <div key={id} className='border-border flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0'>
                  <span>{text(row.name || row.type)} <span className='text-muted-foreground'>{id}</span></span>
                  <Button size='sm' variant='destructive' onClick={async () => {
                    const outcome = await act(
                      () => api(appRequest(appName, `broadcasts/social-networks/${id}`), { method: 'DELETE' }),
                      { ok: 'Social endpoint revoked.', fail: 'The endpoint was not revoked.' }
                    );
                    if (outcome.ok) refresh();
                  }}><Icons.trash /> Revoke</Button>
                </div>
              );
            })}
            {comments.length ? (
              <div className='border-border border-t p-4'>
                <h3 className='mb-2 text-sm font-medium'>Live comments</h3>
                <RecordTable data={comments} />
              </div>
            ) : null}
          </Panel>
          <div className='flex flex-col gap-4'>
            <Panel className='flex flex-col gap-3 p-4'>
              <h3 className='text-sm font-medium'>Connect</h3>
              <form className='flex flex-col gap-3' onSubmit={connectSocial}>
                <Field label='Network'>
                  <select className={selectClass} value={socialForm.network} onChange={(event) => setSocialForm({ ...socialForm, network: event.target.value })}>
                    <option value='facebook'>Facebook</option>
                    <option value='youtube'>YouTube</option>
                    <option value='periscope'>Periscope</option>
                  </select>
                </Field>
                <Button type='submit' size='sm'>Start device authorization</Button>
              </form>
            </Panel>
            <Panel className='flex flex-col gap-3 p-4'>
              <h3 className='text-sm font-medium'>Channel</h3>
              <Field label='Service id'><Input value={socialForm.serviceId} onChange={(event) => setSocialForm({ ...socialForm, serviceId: event.target.value })} /></Field>
              <Field label='Channel type'><Input value={socialForm.channelType} onChange={(event) => setSocialForm({ ...socialForm, channelType: event.target.value })} /></Field>
              <Button type='button' size='sm' variant='outline' onClick={() => show('Channels', `broadcasts/social-networks-channel-lists/${socialForm.serviceId}/${socialForm.channelType}`)}>List channels</Button>
              <Field label='Channel id'><Input value={socialForm.channel} onChange={(event) => setSocialForm({ ...socialForm, channel: event.target.value })} /></Field>
              <Button type='button' size='sm' variant='outline' onClick={() => act(() => api(appRequest(appName, `broadcasts/social-networks-channels/${socialForm.serviceId}/${socialForm.channelType}/${encodeURIComponent(socialForm.channel)}`), { method: 'PUT', body: '{}' }), { ok: 'Channel saved.', fail: 'The channel was not saved.' })}>Set channel</Button>
              <Field label='Stream id'><Input value={socialForm.streamId} onChange={(event) => setSocialForm({ ...socialForm, streamId: event.target.value })} /></Field>
              <Button type='button' size='sm' variant='outline' onClick={loadComments}>Comments and view count</Button>
            </Panel>
          </div>
        </div>
      ) : null}

      <Dialog open={player != null} onOpenChange={(open) => { if (!open) setPlayer(null); }}>
        <DialogContent className='gap-0 overflow-hidden p-0 sm:max-w-4xl'>
          <DialogHeader className='px-4 py-3 pr-12'>
            <DialogTitle>{player?.title}</DialogTitle>
            {player && player.protocol !== 'vod' ? (
              <div className='flex gap-2'>
                <Button size='sm' variant={player.protocol === 'webrtc' && !player.multitrack ? 'default' : 'outline'} onClick={() => setPlayer({ ...player, protocol: 'webrtc', multitrack: false })}><Icons.broadcast /> WebRTC</Button>
                <Button size='sm' variant={player.protocol === 'hls' ? 'default' : 'outline'} onClick={() => setPlayer({ ...player, protocol: 'hls', multitrack: false })}><Icons.play /> HLS</Button>
              </div>
            ) : null}
          </DialogHeader>
          <div className='relative aspect-video bg-black'>
            {player ? (
              <iframe key={playerSrc(player)} src={playerSrc(player)} title={player.title} className='absolute inset-0 h-full w-full' allow='autoplay; fullscreen; camera; microphone; display-capture' allowFullScreen />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
      {detail ? (
        <Panel className='mt-4 p-4'>
          <div className='mb-2 flex items-center justify-between'>
            <h3 className='text-sm font-medium'>{detailTitle}</h3>
            <Button size='sm' variant='outline' onClick={() => setDetail(null)}>Close</Button>
          </div>
          <RecordTable data={detail} />
        </Panel>
      ) : null}
    </div>
  );
}
