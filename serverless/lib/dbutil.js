import { api, db } from 'sdk';
import { users, messages, settings } from 'schema';
import { eq, desc, sql, and } from 'sdk/db';
import { OWNER_IDS, isOwner } from 'lib/config';

export async function settingGet(key, fallback) {
  try {
    const rows = (await db.select().from(settings).where(eq(settings.key, key)).limit(1).all()) || [];
    if (rows[0] && rows[0].value != null) return String(rows[0].value);
  } catch (_e) {}
  return fallback != null ? String(fallback) : '';
}

export async function settingSet(key, value) {
  const k = String(key);
  const v = String(value);
  try {
    await db.insert(settings).values({ key: k, value: v }).run();
  } catch (_e) {
    try {
      await db.update(settings).set({ value: v }).where(eq(settings.key, k)).run();
    } catch (e2) {
      console.error('settingSet', e2);
    }
  }
}

export async function isBotOn() {
  return (await settingGet('bot_enabled', '1')) !== '0';
}

export async function setBotOn(on) {
  await settingSet('bot_enabled', on ? '1' : '0');
}

export async function upsertUser(from) {
  if (!from || !from.id) return;
  const uid = Number(from.id);
  const row = {
    userId: uid,
    username: from.username ? String(from.username) : null,
    firstName: from.first_name ? String(from.first_name) : null,
    lastName: from.last_name ? String(from.last_name) : null,
    started: 1,
    lastSeen: new Date(),
  };
  if (isOwner(uid)) row.role = 'owner';
  try {
    const existing = (await db.select().from(users).where(eq(users.userId, uid)).limit(1).all()) || [];
    if (existing[0]) {
      await db
        .update(users)
        .set({
          username: row.username,
          firstName: row.firstName,
          lastName: row.lastName,
          started: 1,
          lastSeen: row.lastSeen,
          role: isOwner(uid) ? 'owner' : existing[0].role || 'user',
        })
        .where(eq(users.userId, uid))
        .run();
    } else {
      await db
        .insert(users)
        .values({
          userId: uid,
          username: row.username,
          firstName: row.firstName,
          lastName: row.lastName,
          role: isOwner(uid) ? 'owner' : 'user',
          started: 1,
        })
        .run();
    }
  } catch (e) {
    console.error('upsertUser', e);
  }
}

export async function getUser(userId) {
  try {
    const rows = (await db.select().from(users).where(eq(users.userId, Number(userId))).limit(1).all()) || [];
    return rows[0] || null;
  } catch (_e) {
    return null;
  }
}

export async function findUserByUsername(uname) {
  const u = String(uname || '')
    .replace(/^@/, '')
    .toLowerCase()
    .trim();
  if (!u) return null;
  try {
    const all = (await db.select().from(users).orderBy(desc(users.lastSeen)).limit(5000).all()) || [];
    return all.find(function (r) {
      return String(r.username || '').toLowerCase() === u;
    }) || null;
  } catch (_e) {
    return null;
  }
}

export async function listRecentUsers(limit) {
  const lim = Math.min(Number(limit) || 10, 30);
  try {
    return (
      (await db.select().from(users).orderBy(desc(users.lastSeen)).limit(lim).all()) || []
    );
  } catch (_e) {
    return [];
  }
}

export async function saveMessage(userId, content) {
  try {
    const ins = await db.insert(messages).values({
      userId: Number(userId),
      content: String(content || ''),
      status: 'unread',
    });
    let id = ins && (ins.lastInsertRowid || ins.insertId || ins.id);
    if (!id) {
      const rows =
        (await db
          .select()
          .from(messages)
          .where(eq(messages.userId, Number(userId)))
          .orderBy(desc(messages.id))
          .limit(1)
          .all()) || [];
      id = rows[0] && rows[0].id;
    }
    return Number(id) || null;
  } catch (e) {
    console.error('saveMessage', e);
    return null;
  }
}

export async function getMessage(id) {
  try {
    const rows = (await db.select().from(messages).where(eq(messages.id, Number(id))).limit(1).all()) || [];
    return rows[0] || null;
  } catch (_e) {
    return null;
  }
}

export async function listUnread(limit) {
  const lim = Math.min(Number(limit) || 20, 40);
  try {
    return (
      (await db
        .select()
        .from(messages)
        .where(eq(messages.status, 'unread'))
        .orderBy(desc(messages.id))
        .limit(lim)
        .all()) || []
    );
  } catch (_e) {
    return [];
  }
}

export async function listPrevious(limit) {
  const lim = Math.min(Number(limit) || 20, 40);
  try {
    const all =
      (await db.select().from(messages).orderBy(desc(messages.id)).limit(lim * 2).all()) || [];
    return all.filter(function (r) {
      return String(r.status) !== 'unread';
    }).slice(0, lim);
  } catch (_e) {
    return [];
  }
}

export async function markRead(id) {
  try {
    await db
      .update(messages)
      .set({ status: 'read', readAt: new Date() })
      .where(eq(messages.id, Number(id)))
      .run();
  } catch (e) {
    console.error('markRead', e);
  }
}

export async function setReplied(id, replyText) {
  try {
    await db
      .update(messages)
      .set({ status: 'replied', ownerReply: String(replyText || ''), readAt: new Date() })
      .where(eq(messages.id, Number(id)))
      .run();
  } catch (e) {
    console.error('setReplied', e);
  }
}

export async function notifyOwners(text, extra) {
  for (const oid of OWNER_IDS) {
    try {
      await api.sendMessage({
        chat_id: Number(oid),
        text: String(text || ''),
        ...(extra || {}),
      });
    } catch (e) {
      console.error('notifyOwners', oid, e);
    }
  }
}

export function formatUserCard(u) {
  if (!u) return 'کاربر یافت نشد.';
  const name = [u.firstName || u.first_name, u.lastName || u.last_name].filter(Boolean).join(' ') || '—';
  const un = u.username ? '@' + String(u.username).replace(/^@/, '') : 'ندارد';
  return (
    '👤 پروفایل کاربر\n\n' +
    '• نام: ' +
    name +
    '\n• یوزرنیم: ' +
    un +
    '\n• آیدی عددی: `' +
    (u.userId || u.user_id) +
    '`\n• نقش: ' +
    (u.role || 'user')
  );
}
