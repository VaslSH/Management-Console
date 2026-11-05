'use client';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { readSession } from '@/lib/session';
import { useState } from 'react';
import { act } from './feedback';
import { Field, PageTitle, Panel } from './shell';

export function SupportView() {
  const session = readSession();
  const [form, setForm] = useState({
    name: '',
    email: session?.email || '',
    title: '',
    description: '',
    sendSystemInfo: true
  });
  const [message, setMessage] = useState('');

  return (
    <div>
      <PageTitle kicker='Vasl' title='Support' />
      <div className='grid gap-6 lg:grid-cols-[1fr_280px]'>
        <Panel className='p-4'>
          <form
            className='flex flex-col gap-3'
            onSubmit={async (event) => {
              event.preventDefault();
              setMessage('');
              const outcome = await act(
                () => api('/support/request', { method: 'POST', body: JSON.stringify(form) }),
                { ok: 'Request sent.', fail: 'The request did not go through. Email support@vasl.sh.' }
              );
              setMessage(outcome.ok ? 'Request sent.' : 'The request did not go through. Email support@vasl.sh.');
            }}
          >
            <Field label='Name'>
              <Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </Field>
            <Field label='Email'>
              <Input type='email' required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </Field>
            <Field label='Subject'>
              <Input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            </Field>
            <Field label='What happened'>
              <textarea className='border-input min-h-32 rounded-lg border bg-transparent px-2.5 py-2 text-sm' required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </Field>
            <label className='text-muted-foreground flex items-center gap-2 text-sm'>
              <input type='checkbox' checked={form.sendSystemInfo} onChange={(event) => setForm({ ...form, sendSystemInfo: event.target.checked })} />
              Include server version and resource info
            </label>
            <Button type='submit'><Icons.send /> Send</Button>
            {message ? <p className='text-sm'>{message}</p> : null}
          </form>
        </Panel>
        <div className='text-muted-foreground flex flex-col gap-3 text-sm'>
          <a className='text-primary inline-flex items-center gap-1.5' href='https://vasl.sh/' target='_blank' rel='noreferrer'>
            <Icons.externalLink className='size-4' /> vasl.sh
          </a>
          <a className='text-primary inline-flex items-center gap-1.5' href='https://calendly.com/vasl_sh' target='_blank' rel='noreferrer'>
            <Icons.calendar className='size-4' /> Book a consultancy
          </a>
          <a className='text-primary inline-flex items-center gap-1.5' href='mailto:support@vasl.sh'>
            <Icons.send className='size-4' /> support@vasl.sh
          </a>
        </div>
      </div>
    </div>
  );
}
