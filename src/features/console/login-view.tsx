'use client';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { hashPassword } from '@/lib/password';
import { firstApp, hasSystemAccess, isHostedPreview, parseAccessMessage, writeSession } from '@/lib/session';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Field } from './shell';
import { ThemeSwitch } from './theme-switch';

export function LoginView() {
  const router = useRouter();
  const [firstLogin, setFirstLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    api<{ success?: boolean }>('/first-login-status')
      .then((data) => setFirstLogin(Boolean(data?.success)))
      .catch(() => setFirstLogin(false));
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);
    try {
      if (isHostedPreview()) {
        writeSession(email, { system: 'ADMIN' });
        router.replace('/dashboard/');
        return;
      }
      if (firstLogin) {
        if (password !== confirm) {
          const message = 'Passwords do not match.';
          setError(message);
          toast.error(message);
          return;
        }
        const created = await api<{ success?: boolean }>('/users/initial', {
          method: 'POST',
          body: JSON.stringify({ email, password: hashPassword(password) })
        });
        if (!created?.success) {
          const message = 'The first account could not be created.';
          setError(message);
          toast.error(message);
          return;
        }
        setFirstLogin(false);
        setInfo('Account created. Sign in with that email.');
        toast.success('Account created. Sign in with that email.');
        setPassword('');
        setConfirm('');
        return;
      }
      const blocked = await api<{ success?: boolean }>(`/users/${encodeURIComponent(email)}/blocked`).catch(() => ({ success: false }));
      if (blocked?.success) {
        const message = 'This account is blocked. Try again later or ask an administrator.';
        setError(message);
        toast.error(message);
        return;
      }
      const data = await api<{ success?: boolean; message?: string }>('/users/authenticate', {
        method: 'POST',
        body: JSON.stringify({ email, password: hashPassword(password) })
      });
      if (!data?.success) {
        const message = 'Those credentials were not accepted.';
        setError(message);
        toast.error(message);
        return;
      }
      const access = parseAccessMessage(String(data.message || ''));
      writeSession(email, access);
      if (hasSystemAccess(access)) router.replace('/dashboard/');
      else router.replace(`/applications/?name=${encodeURIComponent(firstApp(access))}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign-in failed.';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className='flex min-h-screen items-center justify-center px-4 py-10'>
      <form onSubmit={submit} className='border-border bg-card/90 w-full max-w-md overflow-hidden rounded-lg border shadow-[0_24px_50px_-28px_oklch(0.2_0.04_250/0.55)]'>
        <div className='h-1 bg-[linear-gradient(90deg,var(--primary),oklch(0.83_0.165_78))]' />
        <div className='p-6 md:p-8'>
          <div className='flex items-start justify-between gap-4'>
            <img src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/vasl-logo.png`} alt='Vasl' className='vasl-wordmark h-14 w-auto' />
            <ThemeSwitch />
          </div>
          <p className='vasl-kicker mt-6'>{firstLogin ? 'Setup' : 'Console'}</p>
          <h1 className={cn('font-[family-name:var(--font-display)] mt-2 leading-[0.95] font-bold tracking-normal uppercase', firstLogin ? 'text-3xl' : 'text-4xl')}>
            {firstLogin ? 'Create the first account' : 'Sign in'}
          </h1>
          <p className='text-muted-foreground mt-3 text-sm leading-6'>
            {firstLogin
              ? 'This server has no operator yet. The account you create here administers the machine.'
              : isHostedPreview()
                ? 'Any email and password opens this preview.'
                : 'Use the operator account for this media server.'}
          </p>
          <div className='mt-6 flex flex-col gap-4'>
            <Field label='Email'>
              <Input className='h-9' type={isHostedPreview() ? 'text' : 'email'} required autoFocus value={email} onChange={(event) => setEmail(event.target.value)} autoComplete='username' disabled={busy} />
            </Field>
            <PasswordField
              label='Password'
              value={password}
              onChange={setPassword}
              visible={showPassword}
              onToggle={() => setShowPassword((value) => !value)}
              autoComplete={firstLogin ? 'new-password' : 'current-password'}
              disabled={busy}
            />
            {firstLogin ? (
              <PasswordField
                label='Confirm password'
                value={confirm}
                onChange={setConfirm}
                visible={showConfirm}
                onToggle={() => setShowConfirm((value) => !value)}
                autoComplete='new-password'
                disabled={busy}
              />
            ) : null}
          </div>
          {error ? (
            <p className='border-destructive/40 bg-destructive/10 text-destructive mt-4 flex items-start gap-2 rounded-md border px-3 py-2 text-sm'>
              <Icons.warning className='mt-0.5 size-4 shrink-0' />
              <span>{error}</span>
            </p>
          ) : null}
          {info ? (
            <p className='border-primary/40 bg-primary/10 text-primary mt-4 flex items-start gap-2 rounded-md border px-3 py-2 text-sm'>
              <Icons.circleCheck className='mt-0.5 size-4 shrink-0' />
              <span>{info}</span>
            </p>
          ) : null}
          <Button type='submit' className='mt-6 h-9 w-full' disabled={busy}>
            {busy ? <Icons.spinner className='animate-spin' /> : firstLogin ? <Icons.add /> : <Icons.login />}
            {busy ? 'Working…' : firstLogin ? 'Create account' : 'Sign in'}
          </Button>
        </div>
      </form>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  visible,
  onToggle,
  autoComplete,
  disabled
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  autoComplete: string;
  disabled: boolean;
}) {
  return (
    <Field label={label}>
      <div className='relative'>
        <Input
          className='h-9 pr-9'
          type={visible ? 'text' : 'password'}
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          disabled={disabled}
        />
        <button
          type='button'
          className='text-muted-foreground hover:text-foreground absolute top-1/2 right-1 inline-flex size-7 -translate-y-1/2 items-center justify-center'
          onClick={onToggle}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          disabled={disabled}
        >
          {visible ? <Icons.eyeOff className='size-4' /> : <Icons.eye className='size-4' />}
        </button>
      </div>
    </Field>
  );
}
