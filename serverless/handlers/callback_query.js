import { api } from 'sdk';
import { isOwner, WELCOME_USER } from 'lib/config';
import {
  getUser,
  getMessage,
  markRead,
  formatUserCard,
  isBotOn,
  uidOf,
} from 'lib/dbutil';
import {
  ownerKeyboard,
  userKeyboard,
  userStartInline,
  backKeyboard,
  sanitizeMarkup,
} from 'lib/keyboards';
import { setState, clearState } from 'lib/state';

async function answer(cq, text, alert) {
  try {
    await api.answerCallbackQuery({
      callback_query_id: cq.id,
      text: String(text || '').slice(0, 180),
      show_alert: !!alert,
    });
  } catch (_e) {}
}

export default async function (cq) {
  try {
    if (!cq || !cq.data || !cq.from) return;
    const userId = Number(cq.from.id);
    const data = String(cq.data || '');
    const chatId = cq.message && cq.message.chat && cq.message.chat.id;

    // کاربر عادی: شروع ارسال
    if (data === 'user_send') {
      if (isOwner(userId)) {
        await answer(cq, 'مالک از منوی پایین استفاده کند');
        return;
      }
      const on = await isBotOn();
      if (!on) {
        await answer(cq, 'ربات خاموش است', true);
        return;
      }
      await setState(userId, 'compose');
      await answer(cq, 'پیام را بنویسید');
      await api.sendMessage({
        chat_id: chatId,
        text: 'پیام خود را بنویسید و بفرستید.\n(فقط متن)',
        reply_markup: backKeyboard(),
      });
      return;
    }

    if (!isOwner(userId)) {
      await answer(cq, 'فقط مالک', true);
      return;
    }

    if (data === 'back') {
      await clearState(userId);
      await answer(cq, 'بازگشت');
      const botOn = await isBotOn();
      await api.sendMessage({
        chat_id: chatId,
        text: 'منوی مالک',
        reply_markup: ownerKeyboard(botOn),
      });
      return;
    }

    if (data.startsWith('vu:')) {
      const uid = Number(data.slice(3));
      await answer(cq, 'پروفایل');
      const u = await getUser(uid);
      await api.sendMessage({
        chat_id: chatId,
        text: formatUserCard(u),
        reply_markup: ownerKeyboard(await isBotOn()),
      });
      return;
    }

    if (data.startsWith('rd:')) {
      const mid = Number(data.slice(3));
      await markRead(mid);
      await answer(cq, 'خوانده شد');
      return;
    }

    if (data.startsWith('rp:')) {
      const mid = Number(data.slice(3));
      const row = await getMessage(mid);
      if (!row) {
        await answer(cq, 'پیام یافت نشد', true);
        return;
      }
      const peerId = uidOf(row);
      await setState(userId, 'reply', { msgId: mid, peerId: peerId });
      await answer(cq, 'پاسخ را بنویسید');
      await api.sendMessage({
        chat_id: chatId,
        text: 'پاسخ برای پیام #' + mid + ' (کاربر ' + peerId + ') را بنویسید و بفرستید.',
        reply_markup: backKeyboard(),
      });
      return;
    }

    await answer(cq, 'نامشخص');
  } catch (e) {
    console.error('callback', e);
  }
}
