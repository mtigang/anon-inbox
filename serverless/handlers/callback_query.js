import { api } from 'sdk';
import { isOwner } from 'lib/config';
import {
  getUser,
  getMessage,
  markRead,
  formatUserCard,
  isBotOn,
} from 'lib/dbutil';
import { ownerKeyboard, sanitizeMarkup } from 'lib/keyboards';
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
        parse_mode: 'Markdown',
        reply_markup: ownerKeyboard(await isBotOn()),
      });
      return;
    }

    if (data.startsWith('rd:')) {
      const mid = Number(data.slice(3));
      await markRead(mid);
      await answer(cq, 'خوانده شد ✅');
      return;
    }

    if (data.startsWith('rp:')) {
      const mid = Number(data.slice(3));
      const row = await getMessage(mid);
      if (!row) {
        await answer(cq, 'پیام یافت نشد', true);
        return;
      }
      await setState(userId, 'reply', { msgId: mid, peerId: Number(row.userId) });
      await answer(cq, 'پاسخ را بنویسید');
      await api.sendMessage({
        chat_id: chatId,
        text:
          'پاسخ برای پیام #' +
          mid +
          ' (کاربر `' +
          row.userId +
          '`) را بنویسید و بفرستید.\nبرای انصراف /start',
        parse_mode: 'Markdown',
      });
      return;
    }

    await answer(cq, 'نامشخص');
  } catch (e) {
    console.error('callback', e);
  }
}
