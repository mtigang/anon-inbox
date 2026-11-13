import { api } from 'sdk';
import { OWNER_IDS, WELCOME_USER, WELCOME_OWNER, isOwner } from 'lib/config';
import {
  upsertUser,
  getUser,
  isBotOn,
  setBotOn,
  saveMessage,
  listUnread,
  listPrevious,
  listRecentUsers,
  findUserByUsername,
  notifyOwners,
  formatUserCard,
  getMessage,
  setReplied,
  markRead,
} from 'lib/dbutil';
import { userKeyboard, ownerKeyboard, messageActionsInline, sanitizeMarkup } from 'lib/keyboards';
import { setState, getState, clearState } from 'lib/state';

function kbFor(uid, botOn) {
  if (isOwner(uid)) return ownerKeyboard(botOn !== false);
  return userKeyboard();
}

async function deliverMessageCard(chatId, row) {
  const u = await getUser(row.userId);
  const name = u
    ? [u.firstName || u.first_name, u.lastName || u.last_name].filter(Boolean).join(' ') || '—'
    : '—';
  const un = u && u.username ? '@' + String(u.username).replace(/^@/, '') : '';
  const head =
    '📩 پیام #' +
    row.id +
    ' · ' +
    (String(row.status) === 'unread' ? '🟡 خوانده‌نشده' : String(row.status) === 'replied' ? '💬 پاسخ‌داده‌شده' : '✅ خوانده‌شده') +
    '\nاز: ' +
    name +
    (un ? ' ' + un : '') +
    ' (`' +
    row.userId +
    '`)\n\n';
  await api.sendMessage({
    chat_id: chatId,
    text: head + String(row.content || ''),
    parse_mode: 'Markdown',
    reply_markup: sanitizeMarkup(messageActionsInline(row.id, row.userId)),
  });
}

export default async function (message) {
  try {
    if (!message || !message.chat) return;
    if (message.chat.type !== 'private') return;
    const chatId = message.chat.id;
    const from = message.from;
    if (!from) return;
    const userId = Number(from.id);
    const text = (message.text || '').trim();

    await upsertUser(from);
    const owner = isOwner(userId);
    const botOn = await isBotOn();
    let state = null;
    try {
      state = await getState(userId);
    } catch (_e) {}

    if (text === '/start' || text.startsWith('/start ')) {
      await clearState(userId);
      await api.sendMessage({
        chat_id: chatId,
        text: owner ? WELCOME_OWNER : WELCOME_USER,
        reply_markup: kbFor(userId, botOn),
      });
      return;
    }

    // —— OWNER ——
    if (owner) {
      if (text === '🔴 خاموش کردن ربات') {
        await setBotOn(false);
        await api.sendMessage({
          chat_id: chatId,
          text: '🔴 ربات خاموش شد. کاربران عادی نمی‌توانند پیام بفرستند.',
          reply_markup: kbFor(userId, false),
        });
        return;
      }
      if (text === '🟢 روشن کردن ربات') {
        await setBotOn(true);
        await api.sendMessage({
          chat_id: chatId,
          text: '🟢 ربات روشن شد.',
          reply_markup: kbFor(userId, true),
        });
        return;
      }
      if (text === '📬 پیام‌های خوانده‌نشده') {
        const rows = await listUnread(20);
        if (!rows.length) {
          await api.sendMessage({
            chat_id: chatId,
            text: '📭 پیام خوانده‌نشده‌ای نیست.',
            reply_markup: kbFor(userId, botOn),
          });
          return;
        }
        await api.sendMessage({
          chat_id: chatId,
          text: '📬 ' + rows.length + ' پیام خوانده‌نشده:',
          reply_markup: kbFor(userId, botOn),
        });
        for (const row of rows) {
          try {
            await deliverMessageCard(chatId, row);
          } catch (e) {
            console.error('deliver unread', e);
          }
        }
        return;
      }
      if (text === '📂 پیام‌های قبلی') {
        const rows = await listPrevious(20);
        if (!rows.length) {
          await api.sendMessage({
            chat_id: chatId,
            text: '📂 پیام قبلی ثبت نشده.',
            reply_markup: kbFor(userId, botOn),
          });
          return;
        }
        await api.sendMessage({
          chat_id: chatId,
          text: '📂 ' + rows.length + ' پیام قبلی:',
          reply_markup: kbFor(userId, botOn),
        });
        for (const row of rows) {
          try {
            await deliverMessageCard(chatId, row);
          } catch (e) {
            console.error('deliver prev', e);
          }
        }
        return;
      }
      if (text === '👥 مشاهده کاربران') {
        const rows = await listRecentUsers(10);
        if (!rows.length) {
          await api.sendMessage({
            chat_id: chatId,
            text: 'هنوز کاربری استارت نکرده.',
            reply_markup: kbFor(userId, botOn),
          });
          return;
        }
        let body = '👥 ۱۰ کاربر اخیر (استارت):\n\n';
        for (const u of rows) {
          const name = [u.firstName || u.first_name, u.lastName || u.last_name].filter(Boolean).join(' ') || '—';
          const un = u.username ? '@' + String(u.username).replace(/^@/, '') : '—';
          body += '• ' + name + ' | ' + un + ' | `' + (u.userId || u.user_id) + '`\n';
        }
        body += '\n🔍 برای جستجو: «جستجوی کاربر» را بزنید.';
        await api.sendMessage({
          chat_id: chatId,
          text: body,
          parse_mode: 'Markdown',
          reply_markup: kbFor(userId, botOn),
        });
        return;
      }
      if (text === '🔍 جستجوی کاربر') {
        await setState(userId, 'search_user');
        await api.sendMessage({
          chat_id: chatId,
          text: 'آیدی عددی یا @یوزرنیم کاربر را بفرستید.',
          reply_markup: sanitizeMarkup({ keyboard: [[{ text: '/start' }]], resize_keyboard: true }),
        });
        return;
      }
      if (state && state.kind === 'search_user' && text) {
        await clearState(userId);
        let u = null;
        if (/^\d+$/.test(text.trim())) {
          u = await getUser(text.trim());
        } else {
          u = await findUserByUsername(text.trim());
        }
        await api.sendMessage({
          chat_id: chatId,
          text: formatUserCard(u),
          parse_mode: 'Markdown',
          reply_markup: kbFor(userId, botOn),
        });
        return;
      }
      if (state && state.kind === 'reply' && text) {
        const mid = Number((state.data && state.data.msgId) || 0);
        const peerId = Number((state.data && state.data.peerId) || 0);
        await clearState(userId);
        if (!mid || !peerId) {
          await api.sendMessage({
            chat_id: chatId,
            text: 'پیام منقضی شد.',
            reply_markup: kbFor(userId, botOn),
          });
          return;
        }
        try {
          await api.sendMessage({
            chat_id: peerId,
            text: '💬 پاسخ مالک:\n\n' + text,
          });
          await setReplied(mid, text);
          await api.sendMessage({
            chat_id: chatId,
            text: '✅ پاسخ به کاربر ارسال شد.',
            reply_markup: kbFor(userId, botOn),
          });
        } catch (e) {
          await api.sendMessage({
            chat_id: chatId,
            text:
              'ارسال نشد (احتمالاً کاربر ربات را بلاک کرده).\n' +
              String((e && (e.description || e.message)) || e).slice(0, 120),
            reply_markup: kbFor(userId, botOn),
          });
        }
        return;
      }
      await api.sendMessage({
        chat_id: chatId,
        text: 'از منوی مالک انتخاب کنید.',
        reply_markup: kbFor(userId, botOn),
      });
      return;
    }

    // —— USER ——
    if (!botOn) {
      await api.sendMessage({
        chat_id: chatId,
        text: '🔴 ربات فعلاً خاموش است. بعداً دوباره تلاش کنید.',
        reply_markup: userKeyboard(),
      });
      return;
    }

    if (text === '🟢 ارسال پیام') {
      await setState(userId, 'compose');
      await api.sendMessage({
        chat_id: chatId,
        text: 'پیام خود را بنویسید و بفرستید.\n(فقط متن)',
        reply_markup: sanitizeMarkup({ keyboard: [[{ text: '/start' }]], resize_keyboard: true }),
      });
      return;
    }

    if (state && state.kind === 'compose' && text) {
      if (text === '/start') {
        await clearState(userId);
        await api.sendMessage({
          chat_id: chatId,
          text: WELCOME_USER,
          reply_markup: userKeyboard(),
        });
        return;
      }
      const mid = await saveMessage(userId, text);
      await clearState(userId);
      await api.sendMessage({
        chat_id: chatId,
        text: '✅ پیام شما ثبت و برای مالک ارسال شد.',
        reply_markup: userKeyboard(),
      });
      // فوری به مالک‌ها
      const name = [from.first_name, from.last_name].filter(Boolean).join(' ') || '—';
      const un = from.username ? '@' + from.username : '';
      for (const oid of OWNER_IDS) {
        try {
          await api.sendMessage({
            chat_id: Number(oid),
            text:
              '📩 پیام جدید #' +
              (mid || '?') +
              '\nاز: ' +
              name +
              (un ? ' ' + un : '') +
              ' (`' +
              userId +
              '`)\n\n' +
              text,
            parse_mode: 'Markdown',
            reply_markup: sanitizeMarkup(messageActionsInline(mid, userId)),
          });
        } catch (e) {
          console.error('notify owner', oid, e);
        }
      }
      return;
    }

    await api.sendMessage({
      chat_id: chatId,
      text: 'از دکمه «🟢 ارسال پیام» استفاده کنید یا /start',
      reply_markup: userKeyboard(),
    });
  } catch (e) {
    console.error('message handler', e);
    try {
      await api.sendMessage({
        chat_id: message.chat.id,
        text: '⚠️ خطا. /start\n' + String((e && e.message) || e).slice(0, 100),
      });
    } catch (_e) {}
  }
}
