'use client';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { Notice, Panel } from './shell';

type Value = string | number | boolean | null | Record<string, unknown> | unknown[];

export interface SettingGroup {
  title: string;
  keys: string[];
}

function isPlain(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

const settingLabels: Record<string, string> = {
  webRTCEnabled: 'WebRTC',
  webRTCFrameRate: 'Frame rate',
  h264Enabled: 'H264',
  h265Enabled: 'H265',
  vp8Enabled: 'VP8',
  vp9Enabled: 'VP9',
  av1Enabled: 'AV1',
  encoderSettings: 'Encoder ladder',
  hlsMuxingEnabled: 'HLS',
  hlsListSize: 'Playlist length',
  hlsTime: 'Segment length',
  hlsPlayListType: 'Playlist type',
  deleteHLSFilesOnEnded: 'Delete HLS when the stream ends',
  lLHLSEnabled: 'Low latency HLS',
  dashMuxingEnabled: 'DASH',
  dashSegmentDuration: 'Segment length',
  dashFragmentDuration: 'Fragment length',
  deleteDASHFilesOnEnded: 'Delete DASH when the stream ends',
  lLDashEnabled: 'Low latency DASH',
  dataChannelEnabled: 'Data channel',
  dataChannelPlayerDistribution: 'Distribute to players',
  mp4MuxingEnabled: 'MP4 recording',
  webMMuxingEnabled: 'WebM recording',
  addDateTimeToMp4FileName: 'Add the date to MP4 names',
  vodFolder: 'VoD folder',
  s3RecordingEnabled: 'Store recordings in S3',
  s3AccessKey: 'S3 access key',
  s3SecretKey: 'S3 secret key',
  s3BucketName: 'S3 bucket',
  s3RegionName: 'S3 region',
  s3Endpoint: 'S3 endpoint',
  publishTokenControlEnabled: 'Publish token',
  playTokenControlEnabled: 'Play token',
  playJwtControlEnabled: 'Play JWT',
  publishJwtControlEnabled: 'Publish JWT',
  jwtStreamSecretKey: 'Stream JWT secret',
  listenerHookURL: 'Webhook URL',
  acceptOnlyStreamsInDataStore: 'Only streams created here',
  serverName: 'Server name',
  logLevel: 'Log level'
};

const ladderPresets = [
  { height: 2880, video: 8000, audio: 320, label: '2880p' },
  { height: 2160, video: 6000, audio: 256, label: '2160p' },
  { height: 1080, video: 2500, audio: 256, label: '1080p' },
  { height: 720, video: 2000, audio: 128, label: '720p' },
  { height: 640, video: 1800, audio: 96, label: '640p' },
  { height: 540, video: 1500, audio: 96, label: '540p' },
  { height: 480, video: 1000, audio: 96, label: '480p' },
  { height: 360, video: 800, audio: 64, label: '360p' },
  { height: 240, video: 500, audio: 32, label: '240p' }
];

const selectClass = 'border-input h-8 w-full rounded-lg border bg-transparent px-2 text-sm';

type LadderRow = { height: number; videoBitrate: number; audioBitrate: number };

function asLadder(value: unknown): LadderRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    return [{
      height: Number(row.height) || 0,
      videoBitrate: Number(row.videoBitrate) || 0,
      audioBitrate: Number(row.audioBitrate) || 0
    }];
  });
}

function kbps(bps: number) {
  return bps ? String(Math.round(bps / 1000)) : '';
}

function EncoderLadder({
  value,
  codecs,
  onChange
}: {
  value: unknown;
  codecs: Record<string, unknown>;
  onChange: (next: LadderRow[]) => void;
}) {
  const rows = asLadder(value);
  const both = Boolean(codecs.vp8Enabled || codecs.vp9Enabled) && Boolean(codecs.h264Enabled);

  function write(next: LadderRow[]) {
    onChange(next);
  }

  function update(index: number, patch: Partial<LadderRow>) {
    write(rows.map((row, item) => (item === index ? { ...row, ...patch } : row)));
  }

  return (
    <div className='flex flex-col gap-3 md:col-span-2'>
      {rows.length === 0 ? (
        <Notice tone='info'>
          {both
            ? 'Adaptive streaming is process intensive. Add at least one bitrate if you want both VP8/VP9 and H.264.'
            : 'Adaptive streaming is process intensive. Add a bitrate only if you need it.'}
        </Notice>
      ) : null}
      {rows.length > 0 ? (
        <div className='text-muted-foreground hidden gap-2 text-xs md:grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_2rem]'>
          <span>Resolution</span>
          <span>Video bitrate (kbps)</span>
          <span>Audio bitrate (kbps)</span>
          <span />
        </div>
      ) : null}
      {rows.map((row, index) => {
        const known = ladderPresets.some((preset) => preset.height === row.height);
        return (
          <div key={index} className='grid items-end gap-2 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_2rem]'>
            <label className='flex flex-col gap-1.5 text-sm'>
              <span className='text-muted-foreground md:sr-only'>Resolution</span>
              <select
                className={selectClass}
                value={row.height || 0}
                onChange={(event) => {
                  const height = Number(event.target.value);
                  const preset = ladderPresets.find((item) => item.height === height);
                  update(index, {
                    height,
                    videoBitrate: preset ? preset.video * 1000 : row.videoBitrate,
                    audioBitrate: preset ? preset.audio * 1000 : row.audioBitrate
                  });
                }}
              >
                <option value={0}>Choose one</option>
                {row.height && !known ? <option value={row.height}>{row.height}p</option> : null}
                {ladderPresets.map((preset) => (
                  <option key={preset.height} value={preset.height}>{preset.label}</option>
                ))}
              </select>
            </label>
            <label className='flex flex-col gap-1.5 text-sm'>
              <span className='text-muted-foreground md:sr-only'>Video bitrate (kbps)</span>
              <Input
                type='number'
                min={10}
                value={kbps(row.videoBitrate)}
                onChange={(event) => update(index, { videoBitrate: Math.round(Number(event.target.value) || 0) * 1000 })}
              />
            </label>
            <label className='flex flex-col gap-1.5 text-sm'>
              <span className='text-muted-foreground md:sr-only'>Audio bitrate (kbps)</span>
              <Input
                type='number'
                min={10}
                value={kbps(row.audioBitrate)}
                onChange={(event) => update(index, { audioBitrate: Math.round(Number(event.target.value) || 0) * 1000 })}
              />
            </label>
            <Button type='button' variant='ghost' size='icon-sm' aria-label='Remove bitrate' onClick={() => write(rows.filter((_, item) => item !== index))}>
              <Icons.close />
            </Button>
          </div>
        );
      })}
      <div>
        <Button type='button' variant='outline' onClick={() => write([...rows, { height: 0, videoBitrate: 0, audioBitrate: 0 }])}>
          <Icons.add /> Add bitrate
        </Button>
      </div>
    </div>
  );
}

function labelFor(key: string) {
  if (settingLabels[key]) return settingLabels[key];
  const spaced = key.replace(/([A-Z])/g, ' $1').replace(/[_-]+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function FieldControl({
  name,
  value,
  onChange
}: {
  name: string;
  value: unknown;
  onChange: (next: Value) => void;
}) {
  const label = labelFor(name);
  if (typeof value === 'boolean') {
    return (
      <label className='border-border flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-sm'>
        <span>{label}</span>
        <input type='checkbox' checked={value} onChange={(event) => onChange(event.target.checked)} />
      </label>
    );
  }
  if (typeof value === 'number') {
    return (
      <label className='flex flex-col gap-1.5 text-sm'>
        <span className='text-muted-foreground'>{label}</span>
        <Input type='number' value={value} onChange={(event) => onChange(Number(event.target.value))} />
      </label>
    );
  }
  if (name === 'logLevel' && (typeof value === 'string' || value == null)) {
    const current = String(value || 'INFO');
    const options = ['INFO', 'WARN', 'ERROR', 'OFF'];
    if (!options.includes(current)) options.unshift(current);
    return (
      <label className='flex flex-col gap-1.5 text-sm'>
        <span className='text-muted-foreground'>{label}</span>
        <select className='border-input h-8 rounded-lg border bg-transparent px-2 text-sm' value={current} onChange={(event) => onChange(event.target.value)}>
          {options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>
    );
  }
  if (typeof value === 'string' || value == null) {
    return (
      <label className='flex flex-col gap-1.5 text-sm'>
        <span className='text-muted-foreground'>{label}</span>
        <Input value={value ?? ''} onChange={(event) => onChange(event.target.value)} />
      </label>
    );
  }
  return (
    <label className='flex flex-col gap-1 text-sm md:col-span-2'>
      <span className='text-muted-foreground'>{labelFor(name)}</span>
      <textarea
        className='border-input bg-transparent min-h-24 rounded-lg border px-2.5 py-2 font-mono text-xs'
        value={JSON.stringify(value, null, 2)}
        onChange={(event) => {
          try {
            onChange(JSON.parse(event.target.value) as Value);
          } catch {
            /* keep typing until the JSON is valid */
          }
        }}
      />
    </label>
  );
}

export const serverSettingGroups: SettingGroup[] = [
  { title: 'Server', keys: ['serverName', 'logLevel'] }
];

export const appSettingGroups: SettingGroup[] = [
  { title: 'WebRTC codecs', keys: ['webRTCEnabled', 'webRTCFrameRate', 'h264Enabled', 'h265Enabled', 'vp8Enabled', 'vp9Enabled', 'av1Enabled'] },
  { title: 'Adaptive streaming', keys: ['encoderSettings'] },
  { title: 'HLS', keys: ['hlsMuxingEnabled', 'hlsListSize', 'hlsTime', 'hlsPlayListType', 'deleteHLSFilesOnEnded', 'lLHLSEnabled'] },
  { title: 'DASH', keys: ['dashMuxingEnabled', 'dashSegmentDuration', 'dashFragmentDuration', 'deleteDASHFilesOnEnded', 'lLDashEnabled'] },
  { title: 'Data channel', keys: ['dataChannelEnabled', 'dataChannelPlayerDistribution'] },
  { title: 'Recording and S3', keys: ['mp4MuxingEnabled', 'webMMuxingEnabled', 'addDateTimeToMp4FileName', 'vodFolder', 's3RecordingEnabled', 's3AccessKey', 's3SecretKey', 's3BucketName', 's3RegionName', 's3Endpoint'] },
  { title: 'Tokens and hooks', keys: ['publishTokenControlEnabled', 'playTokenControlEnabled', 'playJwtControlEnabled', 'publishJwtControlEnabled', 'jwtStreamSecretKey', 'listenerHookURL', 'acceptOnlyStreamsInDataStore'] }
];

export function RecordEditor({
  value,
  onSave,
  groups
}: {
  value: Record<string, unknown>;
  onSave: (next: Record<string, unknown>) => Promise<void>;
  groups?: SettingGroup[];
}) {
  const [draft, setDraft] = useState<Record<string, unknown>>(value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showRest, setShowRest] = useState(false);

  function update(key: string, next: Value) {
    setDraft((current) => ({ ...current, [key]: next }));
  }

  async function save() {
    setBusy(true);
    setError('');
    const ladder = asLadder(draft.encoderSettings);
    if ('encoderSettings' in draft && ladder.some((row) => !row.height || row.videoBitrate < 10000 || row.audioBitrate < 10000)) {
      const message = 'Each bitrate needs a resolution, and video and audio must be at least 10 kbps.';
      setError(message);
      toast.error(message);
      setBusy(false);
      return;
    }
    try {
      await onSave(draft);
      toast.success('Saved.');
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : 'Save failed.';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  const claimed = new Set((groups || []).flatMap((group) => group.keys));
  const grouped = (groups || [])
    .map((group) => ({ title: group.title, keys: group.keys.filter((key) => key in draft) }))
    .filter((group) => group.keys.length > 0);
  const rest = Object.keys(draft)
    .filter((key) => !claimed.has(key))
    .sort();
  const sections = groups?.length ? grouped : [{ title: 'Settings', keys: rest }];

  return (
    <div className='flex flex-col gap-4'>
      {sections.map((section) => (
        <Panel key={section.title} className='p-6 md:p-8'>
          <h3 className='mb-4 text-sm font-medium'>{section.title}</h3>
          <div className='grid gap-3 md:grid-cols-2'>
            {section.keys.map((key) => (
              key === 'encoderSettings' ? (
                <EncoderLadder key={key} value={draft[key]} codecs={draft} onChange={(next) => update(key, next)} />
              ) : (
                <FieldControl key={key} name={key} value={draft[key]} onChange={(next) => update(key, next)} />
              )
            ))}
          </div>
        </Panel>
      ))}
      {groups?.length && rest.length ? (
        <Panel className='p-4'>
          <button type='button' className='text-sm font-medium' onClick={() => setShowRest((value) => !value)}>
            {showRest ? <Icons.chevronUp className='mr-1 inline size-4' /> : <Icons.chevronDown className='mr-1 inline size-4' />}
            {showRest ? 'Hide advanced settings' : `Advanced settings (${rest.length})`}
          </button>
          {showRest ? (
            <div className='mt-4 grid gap-3 md:grid-cols-2'>
              {rest.map((key) => (
                <FieldControl key={key} name={key} value={draft[key]} onChange={(next) => update(key, next)} />
              ))}
            </div>
          ) : null}
        </Panel>
      ) : null}
      {error ? <Notice tone='bad'>{error}</Notice> : null}
      <div>
        <Button type='button' onClick={save} disabled={busy}>
          {busy ? <Icons.spinner className='animate-spin' /> : <Icons.check />}
          {busy ? 'Saving…' : 'Save settings'}
        </Button>
      </div>
    </div>
  );
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return isPlain(value);
}
