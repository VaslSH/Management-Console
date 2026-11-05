'use client';

import { toast } from 'sonner';

type Outcome<T> = { ok: true; result: T } | { ok: false };

function rejection(body: unknown): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const record = body as { success?: unknown; message?: unknown };
  if (record.success !== false) return null;
  return typeof record.message === 'string' ? record.message.trim() : '';
}

export function assertOk<T>(result: T, fail: string): T {
  const rejected = rejection(result);
  if (rejected == null) return result;
  throw new Error(rejected || fail);
}

export async function act<T>(work: () => Promise<T>, messages: { ok?: string; fail: string; flag?: boolean }): Promise<Outcome<T>> {
  try {
    const result = assertOk(await work(), messages.fail);
    if (messages.flag) {
      const accepted = Boolean(result) && typeof result === 'object' && !Array.isArray(result) && (result as { success?: unknown }).success === true;
      if (!accepted) {
        toast.error(messages.fail);
        return { ok: false };
      }
    }
    if (messages.ok) toast.success(messages.ok);
    return { ok: true, result };
  } catch (error) {
    toast.error(error instanceof Error && error.message ? error.message : messages.fail);
    return { ok: false };
  }
}

export async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success('Copied.');
  } catch {
    toast.error('Could not copy.');
  }
}
