'use client';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { hashPassword } from '@/lib/password';
import { readSession } from '@/lib/session';
import { useState } from 'react';
import { act } from './feedback';
import { Field, Notice, PageTitle, Panel } from './shell';

export function PasswordView() {
  const session = readSession();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);

  return (
    <div className='mx-auto w-full max-w-md'>
      <PageTitle kicker='Account' title='Change password' />
      <Panel className='p-6 md:p-8'>
        <form
          className='flex flex-col gap-4'
          onSubmit={async (event) => {
            event.preventDefault();
            setMessage('');
            if (next.length < 7) {
              setFailed(true);
              setMessage('The new password should be at least 7 characters.');
              return;
            }
            if (next !== confirm) {
              setFailed(true);
              setMessage('The new passwords do not match.');
              return;
            }
            const outcome = await act(
              () => api<{ success?: boolean }>('/users/password', {
                method: 'POST',
                body: JSON.stringify({
                  email: session?.email,
                  password: hashPassword(current),
                  newPassword: hashPassword(next)
                })
              }),
              { ok: 'Password updated.', fail: 'The password was not changed.', flag: true }
            );
            setFailed(!outcome.ok);
            setMessage(outcome.ok ? 'Password updated.' : 'Make sure the current password is correct.');
            if (outcome.ok) {
              setCurrent('');
              setNext('');
              setConfirm('');
            }
          }}
        >
          <Field label='Current password'>
            <Input type='password' required autoComplete='current-password' value={current} onChange={(event) => setCurrent(event.target.value)} />
          </Field>
          <Field label='New password'>
            <Input type='password' required minLength={7} autoComplete='new-password' value={next} onChange={(event) => setNext(event.target.value)} />
          </Field>
          <Field label='Confirm new password'>
            <Input type='password' required minLength={7} autoComplete='new-password' value={confirm} onChange={(event) => setConfirm(event.target.value)} />
          </Field>
          {message ? <Notice tone={failed ? 'bad' : 'info'}>{message}</Notice> : null}
          <Button type='submit' className='w-full'><Icons.lock /> Update password</Button>
        </form>
      </Panel>
    </div>
  );
}
