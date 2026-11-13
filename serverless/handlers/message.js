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
  formatUserCard,
  getMessage,
  setReplied,
  uidOf,
  nameOf,
} from 'lib/dbutil';
import {
  userKeyboard,
  userStartInline,
  ownerKeyboard,
  messageActionsInline,
  backKeyboard,
  sanitizeMarkup,
} from 'lib/keyboards';
import { setState, getState, clearState } from 'lib/state';

function kbFor(uid, botOn) {
  if (isOwner(uid)) return ownerKeyboard(botOn !== false);
  return userKeyboard();
}

async function deliverMessageCard(chatId, row) {
  const peerId = uidOf(row);
  let u = null;
  try {
    u = peerId ? await getUser(peerId) : null;
  } catch (_e) {}
  const name = nameOf(u);
  const un = u && u.username ? '@' + String(u.username).replace(/^@/, '') : '';
  const st = String(row.status || '');
  const stLabel =
    st === 'unread' ? 'خوانده‌نشده' : st === 'replied' ? 'پاسخ‌داده‌شده' : 'خوانده‌شده';
  const head =
    'پیام #' +
    row.id +
    ' | ' +
    stLabel +
    '\nاز: ' +
    name +
    (un ? ' ' + un : '') +
    '\nآیدی: ' +
    peerId +
    '\n\n';
  const body = head + String(row.content || '');
  await api.sendMessage({
    chat_id: chatId,
    text: body.slice(0, 4000),
    reply_markup: sanitizeMarkup(messageActionsInline(row.id, peerId)),
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

    // بازگشت
    if (text === 'بازگشت' || text === '/start' || text.startsWith('/start ')) {
      await clearState(userId);
      if (owner) {
        await api.sendMessage({
          chat_id: chatId,
          text: text.startsWith('/start') ? WELCOME_OWNER : 'منوی مالک',
          reply_markup: kbFor(userId, botOn),
        });
      } else {
        await api.sendMessage({
          chat_id: chatId,
          text: text.startsWith('/start') ? WELCOME_USER : 'منوی اصلی',
          reply_markup: userStartInline(),
        });
        // کیبورد پایین هم برای سازگاری
        try {
          await api.sendMessage({
            chat_id: chatId,
            text: 'از دکمه زیر یا دکمه سبز استفاده کنید.',
            reply_markup: userKeyboard(),
          });
        } catch (_e) {}
      }
      return;
    }

    // —— OWNER ——
    if (owner) {
      if (text === 'خاموش کردن ربات') {
        await setBotOn(false);
        await api.sendMessage({
          chat_id: chatId,
          text: 'ربات خاموش شد. کاربران عادی نمی‌توانند پیام بفرستند.',
          reply_markup: kbFor(userId, false),
        });
        return;
      }
      if (text === 'روشن کردن ربات') {
        await setBotOn(true);
        await api.sendMessage({
          chat_id: chatId,
          text: 'ربات روشن شد.',
          reply_markup: kbFor(userId, true),
        });
        return;
      }
      if (text === 'پیام‌های خوانده‌نشده') {
        let rows = [];
        try {
          rows = await listUnread(25);
        } catch (e) {
          console.error('listUnread', e);
        }
        if (!rows || !rows.length) {
          await api.sendMessage({
            chat_id: chatId,
            text: 'پیام خوانده‌نشده‌ای نیست.',
            reply_markup: kbFor(userId, botOn),
          });
          return;
        }
        await api.sendMessage({
          chat_id: chatId,
          text: rows.length + ' پیام خوانده‌نشده:',
          reply_markup: kbFor(userId, botOn),
        });
        for (const row of rows) {
          try {
            await deliverMessageCard(chatId, row);
          } catch (e) {
            console.error('deliver unread', e);
            try {
              await api.sendMessage({
                chat_id: chatId,
                text:
                  'پیام #' +
                  (row && row.id) +
                  ' (نمایش کامل خطا داد)\nآیدی فرستنده: ' +
                  uidOf(row) +
                  '\n' +
                  String((row && row.content) || '').slice(0, 500),
                reply_markup: sanitizeMarkup(messageActionsInline(row.id, uidOf(row))),
              });
            } catch (_e2) {}
          }
        }
        return;
      }
      if (text === 'پیام‌های قبلی') {
        let rows = [];
        try {
          rows = await listPrevious(25);
        } catch (e) {
          console.error('listPrevious', e);
        }
        if (!rows || !rows.length) {
          await api.sendMessage({
            chat_id: chatId,
            text: 'پیام قبلی ثبت نشده.',
            reply_markup: kbFor(userId, botOn),
          });
          return;
        }
        await api.sendMessage({
          chat_id: chatId,
          text: rows.length + ' پیام قبلی:',
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
      if (text === 'مشاهده کاربران') {
        let rows = [];
        try {
          rows = await listRecentUsers(10);
        } catch (e) {
          console.error('listRecentUsers', e);
        }
        if (!rows || !rows.length) {
          await api.sendMessage({
            chat_id: chatId,
            text: 'هنوز کاربری استارت نکرده.',
            reply_markup: kbFor(userId, botOn),
          });
          return;
        }
        let body = '۱۰ کاربر اخیر:\n\n';
        for (const u of rows) {
          const name = nameOf(u);
          const un = u.username ? '@' + String(u.username).replace(/^@/, '') : '—';
          const id = uidOf(u);
          body += name + ' | ' + un + ' | ' + id + '\n';
        }
        body += '\nبرای جستجو: جستجوی کاربر';
        await api.sendMessage({
          chat_id: chatId,
          text: body,
          reply_markup: kbFor(userId, botOn),
        });
        return;
      }
      if (text === 'جستجوی کاربر') {
        await setState(userId, 'search_user');
        await api.sendMessage({
          chat_id: chatId,
          text: 'آیدی عددی یا یوزرنیم کاربر را بفرستید.',
          reply_markup: backKeyboard(),
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
            text: 'پاسخ مالک:\n\n' + text,
          });
          await setReplied(mid, text);
          await api.sendMessage({
            chat_id: chatId,
            text: 'پاسخ به کاربر ارسال شد.',
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
        text: 'ربات فعلاً خاموش است. بعداً دوباره تلاش کنید.',
        reply_markup: userStartInline(),
      });
      return;
    }

    if (text === 'ارسال پیام') {
      await setState(userId, 'compose');
      await api.sendMessage({
        chat_id: chatId,
        text: 'پیام خود را بنویسید و بفرستید.\n(فقط متن)',
        reply_markup: backKeyboard(),
      });
      return;
    }

    if (state && state.kind === 'compose' && text) {
      const mid = await saveMessage(userId, text);
      await clearState(userId);
      await api.sendMessage({
        chat_id: chatId,
        text: 'پیام شما ثبت و برای مالک ارسال شد.',
        reply_markup: userKeyboard(),
      });
      try {
        await api.sendMessage({
          chat_id: chatId,
          text: 'می‌توانید دوباره ارسال کنید.',
          reply_markup: userStartInline(),
        });
      } catch (_e) {}

      const name = [from.first_name, from.last_name].filter(Boolean).join(' ') || '—';
      const un = from.username ? '@' + from.username : '';
      const notifyText =
        'پیام جدید #' +
        (mid || '?') +
        '\nاز: ' +
        name +
        (un ? ' ' + un : '') +
        '\nآیدی: ' +
        userId +
        '\n\n' +
        text;
      for (const oid of OWNER_IDS) {
        try {
          await api.sendMessage({
            chat_id: Number(oid),
            text: notifyText.slice(0, 4000),
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
      text: 'از دکمه ارسال پیام استفاده کنید.',
      reply_markup: userStartInline(),
    });
  } catch (e) {
    console.error('message handler', e);
    try {
      await api.sendMessage({
        chat_id: message.chat.id,
        text: 'خطا. /start\n' + String((e && e.message) || e).slice(0, 100),
      });
    } catch (_e) {}
  }
}
