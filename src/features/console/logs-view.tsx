'use client';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useEffect, useRef, useState } from 'react';
import { PageTitle, Panel } from './shell';

export function LogsView() {
  const [kind, setKind] = useState<'server' | 'error'>('server');
  const [text, setText] = useState('');
  const [offset, setOffset] = useState(-1);
  const scroller = useRef<HTMLPreElement>(null);
  const follow = useRef(true);

  useEffect(() => {
    let current = -1;
    let stopped = false;
    let pulling = false;
    follow.current = true;
    setText('');
    setOffset(-1);

    async function pull() {
      if (pulling || stopped) return;
      pulling = true;
      try {
        const data = await api<{ logContent?: string; logFileSize?: number; logContentSize?: number }>(
          `/log-file/${current}/10000/?logType=${kind}`
        );
        if (stopped) return;
        if (data.logContent) setText((value) => value + data.logContent);
        if (current === -1 && data.logFileSize && data.logFileSize > 0) current = data.logFileSize;
        else current += data.logContentSize || 0;
        setOffset(current);
      } finally {
        pulling = false;
      }
    }

    pull().catch(() => undefined);
    const timer = window.setInterval(() => {
      pull().catch(() => undefined);
    }, 1000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [kind]);

  useEffect(() => {
    const node = scroller.current;
    if (!node || !follow.current) return;
    node.scrollTop = node.scrollHeight;
  }, [text]);

  return (
    <div>
      <PageTitle
        kicker='Server'
        title='Logs'
        action={
          <div className='flex gap-2'>
            <Button variant={kind === 'server' ? 'default' : 'outline'} onClick={() => setKind('server')}>
              <Icons.server /> Server
            </Button>
            <Button variant={kind === 'error' ? 'default' : 'outline'} onClick={() => setKind('error')}>
              <Icons.warning /> Errors
            </Button>
          </div>
        }
      />
      <p className='text-muted-foreground mb-2 font-mono text-xs'>Offset {offset}</p>
      <Panel>
        <pre
          ref={scroller}
          onScroll={(event) => {
            const node = event.currentTarget;
            follow.current = node.scrollHeight - node.scrollTop - node.clientHeight < 48;
          }}
          className='max-h-[70vh] overflow-auto p-4 font-mono text-xs leading-5 whitespace-pre-wrap'
        >
          {text || 'Waiting for log lines…'}
        </pre>
      </Panel>
    </div>
  );
}
