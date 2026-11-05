'use client';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, namesOf, rowsOf } from '@/lib/api';
import { hashPassword } from '@/lib/password';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { act, assertOk } from './feedback';
import { isRecord, RecordEditor, serverSettingGroups } from './record-editor';
import { toast } from 'sonner';
import { Field, PageTitle, Panel } from './shell';

export function SettingsView() {
  const [tab, setTab] = useState<'license' | 'general' | 'ssl' | 'users'>('license');
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [licenceKey, setLicenceKey] = useState('');
  const [licence, setLicence] = useState<Record<string, unknown> | null>(null);
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [apps, setApps] = useState<string[]>([]);
  const [editing, setEditing] = useState('');
  const blankUser = { email: '', password: '', firstName: '', lastName: '', userType: 'ADMIN', fullAccess: true, appRoles: {} as Record<string, string> };
  const [userForm, setUserForm] = useState(blankUser);
  const [ssl, setSsl] = useState({ domain: '', type: 'CUSTOM_DOMAIN' });
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');

  function userPayload(creating: boolean) {
    const payload: Record<string, unknown> = {
      email: userForm.email,
      firstName: userForm.firstName,
      lastName: userForm.lastName,
      userType: userForm.userType
    };
    if (userForm.password) {
      const hashed = hashPassword(userForm.password);
      if (creating) payload.password = hashed;
      else payload.newPassword = hashed;
    }
    if (userForm.fullAccess) {
      payload.scope = 'system';
    } else {
      payload.appNameUserType = userForm.appRoles;
    }
    return payload;
  }

  async function load() {
    try {
      const [server, list, certificate, applications, lastLicence] = await Promise.all([
        api<Record<string, unknown>>('/server-settings'),
        api('/user-list').catch(() => []),
        api<Record<string, unknown>>('/ssl-settings/').catch(() => ({})),
        api('/applications').catch(() => []),
        api<Record<string, unknown>>('/last-licence-status').catch(() => ({}))
      ]);
      setSettings(isRecord(server) ? server : null);
      setLicenceKey(isRecord(server) ? String(server.licenceKey || '') : '');
      setLicence(isRecord(lastLicence) ? lastLicence : null);
      setUsers(rowsOf(list));
      setApps(namesOf(applications));
      if (isRecord(certificate)) {
        setSsl({
          domain: String(certificate.domain || ''),
          type: String(certificate.type || 'CUSTOM_DOMAIN')
        });
      }
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Settings could not be loaded.');
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <PageTitle kicker='Server' title='Settings' />
      <div className='mb-4 flex gap-2'>
        {([
        ['license', 'License', Icons.key],
        ['general', 'General', Icons.settings],
        ['ssl', 'TLS', Icons.lock],
        ['users', 'Users', Icons.teams]
      ] as const).map(([item, label, Icon]) => (
          <Button key={item} variant={tab === item ? 'default' : 'outline'} onClick={() => setTab(item)}>
            <Icon /> {label}
          </Button>
        ))}
      </div>
      {error ? <p className='text-destructive mb-3 text-sm'>{error}</p> : null}
      {tab === 'license' && settings ? (
        <LicenseSettings
          settings={settings}
          licenceKey={licenceKey}
          licence={licence}
          onKeyChange={setLicenceKey}
          onSaved={(next, status) => {
            setSettings(next);
            setLicence(status);
          }}
        />
      ) : null}
      {tab === 'general' && settings ? (
        <div className='mx-auto w-full max-w-3xl'>
          <RecordEditor
            groups={serverSettingGroups}
            value={Object.fromEntries(Object.entries(settings).filter(([key]) => key !== 'licenceKey'))}
            onSave={async (next) => {
              const merged = { ...settings, ...next, licenceKey: settings.licenceKey };
              assertOk(await api('/server-settings', { method: 'POST', body: JSON.stringify(merged) }), 'Settings were not saved.');
              setSettings(merged);
            }}
          />
        </div>
      ) : null}
      {tab === 'ssl' ? (
        <div className='mx-auto w-full max-w-3xl'>
          <Panel className='p-6 md:p-8'>
            <form
              className='grid gap-4 md:grid-cols-2'
              onSubmit={async (event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                const outcome = await act(
                  () => api(`/ssl-settings?domain=${encodeURIComponent(ssl.domain)}&type=${encodeURIComponent(ssl.type)}`, {
                    method: 'POST',
                    body: data
                  }),
                  { ok: 'TLS settings saved.', fail: 'TLS settings were not saved.' }
                );
                if (!outcome.ok) return;
              }}
            >
              <Field label='Domain'>
                <Input required value={ssl.domain} onChange={(event) => setSsl({ ...ssl, domain: event.target.value })} />
              </Field>
              <Field label='Certificate type'>
                <select className='border-input h-8 rounded-lg border bg-transparent px-2 text-sm' value={ssl.type} onChange={(event) => setSsl({ ...ssl, type: event.target.value })}>
                  <option value='CUSTOM_DOMAIN'>Use your domain</option>
                  <option value='VASL_SUBDOMAIN'>vasl.cloud subdomain</option>
                  <option value='CUSTOM_CERTIFICATE'>Import a certificate</option>
                  <option value='NO_SSL'>No TLS</option>
                </select>
              </Field>
              <Field label='Certificate or key files'>
                <input name='file' type='file' multiple className='text-sm' />
              </Field>
              <div className='flex items-end'>
                <Button type='submit'><Icons.check /> Save TLS</Button>
              </div>
            </form>
          </Panel>
        </div>
      ) : null}
      {tab === 'users' ? (
        <div className='grid items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,26rem)]'>
          <Panel>
            <div className='border-border flex items-center justify-between border-b px-4 py-3'>
              <h2 className='text-sm font-medium'>Accounts</h2>
              <span className='text-muted-foreground font-mono text-xs'>{users.length}</span>
            </div>
            {users.length === 0 ? <p className='text-muted-foreground px-4 py-8 text-sm'>No accounts yet. Add the first operator on the right.</p> : null}
            {users.map((user) => {
              const email = String(user.email || '');
              const roles = isRecord(user.appNameUserType) ? user.appNameUserType : null;
              const access = roles ? Object.entries(roles).map(([app, role]) => `${app === 'system' ? 'Everything' : app} (${role})`).join(', ') : 'Everything';
              const active = editing === email;
              return (
                <div key={email} className={cn('border-border flex items-center justify-between gap-3 border-b px-4 py-3 text-sm last:border-b-0', active && 'bg-primary/5')}>
                  <span className='min-w-0'>
                    <span className='flex items-center gap-2'>
                      <span className='truncate font-medium'>{String(user.fullName || `${user.firstName || ''} ${user.lastName || ''}`).trim() || email}</span>
                      <span className='text-muted-foreground shrink-0 font-mono text-[11px] tracking-wide uppercase'>{String(user.userType || 'ADMIN')}</span>
                    </span>
                    <span className='text-muted-foreground mt-0.5 block truncate text-xs'>{email}</span>
                    <span className='text-muted-foreground mt-0.5 block text-xs'>{access}</span>
                  </span>
                  <span className='flex shrink-0 gap-2'>
                    <Button
                      size='sm'
                      variant={active ? 'default' : 'outline'}
                      onClick={() => {
                        const roles = isRecord(user.appNameUserType) ? user.appNameUserType : null;
                        const appRoles = Object.fromEntries(
                          Object.entries(roles || {})
                            .filter(([app]) => app !== 'system')
                            .map(([app, role]) => [app, String(role)])
                        );
                        setEditing(email);
                        setFormError('');
                        setUserForm({
                          email,
                          password: '',
                          firstName: String(user.firstName || ''),
                          lastName: String(user.lastName || ''),
                          userType: String(user.userType || 'ADMIN'),
                          fullAccess: !roles || 'system' in roles || Object.keys(appRoles).length === 0,
                          appRoles
                        });
                      }}
                    >
                      <Icons.edit /> Edit
                    </Button>
                    <Button
                      size='sm'
                      variant='destructive'
                      onClick={async () => {
                        if (!window.confirm(`Delete ${email}?`)) return;
                        const outcome = await act(
                          () => api(`/users/${encodeURIComponent(email)}`, { method: 'DELETE' }),
                          { ok: `${email} deleted.`, fail: 'The user was not deleted.' }
                        );
                        if (outcome.ok) {
                          if (editing === email) {
                            setEditing('');
                            setUserForm(blankUser);
                          }
                          load();
                        }
                      }}
                    >
                      <Icons.trash /> Delete
                    </Button>
                  </span>
                </div>
              );
            })}
          </Panel>
          <form
            className='border-border bg-card/80 flex flex-col gap-4 rounded-lg border p-5 md:p-6'
            onSubmit={async (event) => {
              event.preventDefault();
              if (!userForm.fullAccess && Object.keys(userForm.appRoles).length === 0) {
                const message = 'Choose at least one application, or give this user access to everything.';
                setFormError(message);
                toast.error(message);
                return;
              }
              setFormError('');
              const outcome = await act(
                () => api('/users', {
                  method: editing ? 'PUT' : 'POST',
                  body: JSON.stringify(userPayload(!editing))
                }),
                { ok: editing ? 'User updated.' : 'User created.', fail: editing ? 'The user was not updated.' : 'The user was not created.' }
              );
              if (!outcome.ok) return;
              setEditing('');
              setUserForm(blankUser);
              load();
            }}
          >
            <h2 className='font-[family-name:var(--font-display)] text-2xl leading-none font-bold tracking-normal uppercase'>{editing ? 'Edit account' : 'New account'}</h2>
            <div className='grid gap-4 sm:grid-cols-2'>
              <Field label='First name'>
                <Input required value={userForm.firstName} onChange={(event) => setUserForm({ ...userForm, firstName: event.target.value })} />
              </Field>
              <Field label='Last name'>
                <Input required value={userForm.lastName} onChange={(event) => setUserForm({ ...userForm, lastName: event.target.value })} />
              </Field>
            </div>
            <Field label='Email'>
              <Input type='email' required disabled={Boolean(editing)} value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} />
            </Field>
            <Field label={editing ? 'New password, optional' : 'Password'}>
              <Input type='password' required={!editing} value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} />
            </Field>
            <Field label='User type'>
              <select className='border-input h-8 rounded-lg border bg-transparent px-2 text-sm' value={userForm.userType} onChange={(event) => setUserForm({ ...userForm, userType: event.target.value })}>
                <option value='ADMIN'>ADMIN</option>
                <option value='BASIC'>BASIC</option>
                <option value='READ_ONLY'>READ_ONLY</option>
              </select>
            </Field>
            <fieldset className='flex flex-col gap-2'>
              <legend className='text-muted-foreground mb-1 text-sm'>Access</legend>
              <label className='flex items-center gap-2 text-sm'>
                <input type='radio' name='access' checked={userForm.fullAccess} onChange={() => setUserForm({ ...userForm, fullAccess: true })} />
                Everything
              </label>
              <label className='flex items-center gap-2 text-sm'>
                <input type='radio' name='access' checked={!userForm.fullAccess} onChange={() => setUserForm({ ...userForm, fullAccess: false })} />
                Selected applications
              </label>
              {userForm.fullAccess ? null : (
                <div className='border-border mt-1 flex max-h-56 flex-col gap-2 overflow-auto rounded-md border p-2'>
                  {apps.length === 0 ? <p className='text-muted-foreground text-sm'>No applications yet.</p> : null}
                  {apps.map((app) => {
                    const selected = app in userForm.appRoles;
                    return (
                      <label key={app} className='flex items-center gap-2 text-sm'>
                        <input
                          type='checkbox'
                          checked={selected}
                          onChange={(event) => {
                            const appRoles = { ...userForm.appRoles };
                            if (event.target.checked) appRoles[app] = userForm.userType;
                            else delete appRoles[app];
                            setUserForm({ ...userForm, appRoles });
                          }}
                        />
                        <span className='min-w-0 flex-1 truncate'>{app}</span>
                        <select
                          aria-label={`${app} role`}
                          disabled={!selected}
                          className='border-input h-7 rounded-md border bg-transparent px-1.5 text-xs'
                          value={userForm.appRoles[app] || userForm.userType}
                          onChange={(event) => setUserForm({ ...userForm, appRoles: { ...userForm.appRoles, [app]: event.target.value } })}
                        >
                          <option value='ADMIN'>ADMIN</option>
                          <option value='BASIC'>BASIC</option>
                          <option value='READ_ONLY'>READ_ONLY</option>
                        </select>
                      </label>
                    );
                  })}
                </div>
              )}
            </fieldset>
            {formError ? <p className='text-destructive text-sm'>{formError}</p> : null}
            <div className='flex flex-wrap gap-2'>
              <Button type='submit'>{editing ? <Icons.check /> : <Icons.add />} {editing ? 'Save user' : 'Add user'}</Button>
              {editing ? (
                <Button type='button' variant='outline' onClick={() => { setEditing(''); setFormError(''); setUserForm(blankUser); }}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function licenceEnd(value: unknown) {
  const parsed = typeof value === 'number' ? value : Date.parse(String(value || ''));
  const endTime = parsed > 0 && parsed < 1e12 ? parsed * 1000 : parsed;
  if (!endTime || Number.isNaN(endTime)) return { label: '', days: null as number | null };
  return {
    label: new Date(endTime).toLocaleDateString(),
    days: Math.ceil((endTime - Date.now()) / 86400000)
  };
}

function describeLicence(licence: Record<string, unknown> | null) {
  if (!licence || Object.keys(licence).length === 0) {
    return { state: 'Not reported', detail: 'The server has not reported a license yet.', tone: 'idle' as const };
  }
  const id = licence.licenceId;
  if (licence && id != null && String(id) !== '') {
    const end = licenceEnd(licence.endDate);
    const until = end.label ? ` until ${end.label}` : '';
    const days = end.days == null ? '' : ` · ${end.days} days left`;
    return {
      state: 'Valid',
      detail: `${licence.owner ? `Owner ${licence.owner}` : 'Licensed'}${until}${days}`,
      tone: 'ok' as const
    };
  }
  const status = String(licence?.status || '');
  if (status === 'serverRequestError') return { state: 'Network is unaccessible', detail: 'Check the connection to the license server.', tone: 'bad' as const };
  if (status === 'LICENSE_EXPIRED') return { state: 'Expired', detail: 'This license is expired. Renew it at vasl.sh.', tone: 'bad' as const };
  if (status === 'INVALID_KEY' || status === 'NO_LICENSE_FOUND') return { state: 'Invalid', detail: 'This license key is invalid.', tone: 'bad' as const };
  if (status === 'LICENSE_BLOCKED') return { state: 'Suspended', detail: 'This license is suspended. Renew it at vasl.sh.', tone: 'bad' as const };
  if (status === 'ALL_LICENSES_ARE_USED') return { state: 'Invalid', detail: 'Every seat on this license is already in use.', tone: 'bad' as const };
  if (status === 'TRIAL_PERIOD_ENDED') return { state: 'Trial expired', detail: 'The trial has ended. Buy a license at vasl.sh or extend the trial.', tone: 'bad' as const };
  return { state: 'Invalid', detail: 'Validate this license.', tone: 'bad' as const };
}

function LicenseSettings({
  settings,
  licenceKey,
  licence,
  onKeyChange,
  onSaved
}: {
  settings: Record<string, unknown>;
  licenceKey: string;
  licence: Record<string, unknown> | null;
  onKeyChange: (value: string) => void;
  onSaved: (settings: Record<string, unknown>, licence: Record<string, unknown> | null) => void;
}) {
  const market = Boolean(settings.buildForMarket);
  const described = describeLicence(licence);
  const StatusIcon = described.tone === 'ok' ? Icons.shieldCheck : described.tone === 'idle' ? Icons.info : Icons.warning;
  const valid = described.state === 'Valid';
  const hourly = String(licence?.type || '') === 'hourly';

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const next = { ...settings, licenceKey: licenceKey.trim() };
    const outcome = await act(async () => {
      assertOk(await api('/server-settings', { method: 'POST', body: JSON.stringify(next) }), 'The license was not saved.');
      return api<Record<string, unknown>>(`/licence-status/?key=${encodeURIComponent(String(next.licenceKey))}`);
    }, { ok: 'License saved.', fail: 'The license was not saved.' });
    if (!outcome.ok) return;
    const status = isRecord(outcome.result) ? outcome.result : null;
    onSaved(next, status);
    const result = describeLicence(status);
    if (result.state !== 'Valid') toast.error(result.detail);
  }

  if (market) {
    return (
      <div className='mx-auto w-full max-w-3xl'>
        <Panel className='flex items-start gap-3 p-6 md:p-8'>
          <span className='bg-primary text-primary-foreground inline-flex size-9 shrink-0 items-center justify-center rounded-md'>
            <Icons.badgeCheck className='size-5' />
          </span>
          <p className='text-sm'>The marketplace edition is already activated. No license key is required.</p>
        </Panel>
      </div>
    );
  }

  return (
    <div className='mx-auto w-full max-w-3xl'>
      <Panel className='p-6 md:p-8'>
        <form className='grid items-start gap-8 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]' onSubmit={save}>
          <div>
            <p className='text-muted-foreground font-mono text-[11px] tracking-[0.14em] uppercase'>License status</p>
            <div className='mt-2 flex items-center gap-2.5'>
              <span
                className={cn(
                  'inline-flex size-8 shrink-0 items-center justify-center rounded-md',
                  described.tone === 'ok' && 'bg-primary text-primary-foreground',
                  described.tone === 'idle' && 'bg-muted text-muted-foreground',
                  described.tone === 'bad' && 'bg-destructive text-white'
                )}
              >
                <StatusIcon className='size-4' />
              </span>
              <p className={valid ? 'text-primary text-lg font-medium' : described.tone === 'idle' ? 'text-muted-foreground text-lg font-medium' : 'text-destructive text-lg font-medium'}>{described.state}</p>
            </div>
            <p className='text-muted-foreground mt-2 text-sm'>{described.detail}</p>
          </div>
          <div className='flex flex-col gap-4'>
            <Field label='License key'>
              <Input required minLength={1} value={licenceKey} onChange={(event) => onKeyChange(event.target.value)} placeholder='License key' />
            </Field>
            {hourly ? (
              <p className='text-sm'>
                Hours used: {String(licence?.hourUsed ?? '—')}
                {licenceKey ? (
                  <>
                    {' '}
                    <a className='text-primary inline-flex items-center gap-1' href={`https://license.vasl.sh/?licenseId=${encodeURIComponent(licenceKey)}`} target='_blank' rel='noreferrer'>
                      Usage details <Icons.externalLink className='size-3.5' />
                    </a>
                  </>
                ) : null}
              </p>
            ) : null}
            <div>
              <Button type='submit'><Icons.check /> Save license</Button>
            </div>
          </div>
        </form>
      </Panel>
    </div>
  );
}
