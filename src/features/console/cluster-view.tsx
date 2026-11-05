'use client';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { api, rowsOf } from '@/lib/api';
import { useEffect, useState } from 'react';
import { act } from './feedback';
import { PageTitle, Panel } from './shell';

export function ClusterView() {
  const [count, setCount] = useState<number | null>(null);
  const [nodes, setNodes] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState('');

  async function load() {
    try {
      const [nodeCount, list] = await Promise.all([
        api<{ count?: number; success?: number | boolean }>('/cluster/node-count'),
        api('/cluster/nodes/0/50')
      ]);
      setCount(typeof nodeCount.count === 'number' ? nodeCount.count : Number(nodeCount.success) || null);
      setNodes(rowsOf(list));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cluster data is unavailable. The server may be running standalone.');
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <PageTitle kicker='Server' title='Cluster' action={<Button variant='outline' onClick={load}><Icons.refresh /> Refresh</Button>} />
      {error ? <p className='text-destructive mb-3 text-sm'>{error}</p> : null}
      <p className='text-muted-foreground mb-4 text-sm'>Nodes in this cluster: {count ?? '—'}</p>
      <Panel>
        {nodes.map((node) => {
          const id = String(node.id || node.ip || JSON.stringify(node));
          return (
            <div key={id} className='border-border flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0'>
              <span className='font-mono text-xs'>{String(node.ip || node.address || id)}</span>
              <Button
                size='sm'
                variant='destructive'
                onClick={async () => {
                  const outcome = await act(
                    () => api(`/cluster/node/${encodeURIComponent(String(node.id))}`, { method: 'DELETE' }),
                    { ok: 'Node removed.', fail: 'The node was not removed.' }
                  );
                  if (outcome.ok) load();
                }}
              >
                <Icons.trash /> Remove
              </Button>
            </div>
          );
        })}
        {nodes.length === 0 ? <p className='text-muted-foreground px-4 py-6 text-sm'>No cluster nodes returned.</p> : null}
      </Panel>
    </div>
  );
}
