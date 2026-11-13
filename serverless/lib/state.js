import { db } from 'sdk';
import { settings } from 'schema';
import { eq } from 'sdk/db';

const PREFIX = 'st:';

export async function setState(userId, kind, data) {
  const key = PREFIX + Number(userId);
  const val = JSON.stringify({ kind: kind || '', data: data || {}, ts: Date.now() });
  try {
    await db.insert(settings).values({ key, value: val }).run();
  } catch (_e) {
    try {
      await db.update(settings).set({ value: val }).where(eq(settings.key, key)).run();
    } catch (e2) {
      console.error('setState', e2);
    }
  }
}

export async function getState(userId) {
  try {
    const rows =
      (await db.select().from(settings).where(eq(settings.key, PREFIX + Number(userId))).limit(1).all()) ||
      [];
    if (!rows[0] || !rows[0].value) return null;
    return JSON.parse(String(rows[0].value));
  } catch (_e) {
    return null;
  }
}

export async function clearState(userId) {
  try {
    await db.delete(settings).where(eq(settings.key, PREFIX + Number(userId))).run();
  } catch (_e) {}
}
