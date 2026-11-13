function sanitizeMarkup(markup) {
  if (!markup || typeof markup !== 'object') return markup;
  const out = {};
  if (markup.resize_keyboard != null) out.resize_keyboard = !!markup.resize_keyboard;
  if (markup.remove_keyboard) {
    out.remove_keyboard = true;
    return out;
  }
  if (Array.isArray(markup.inline_keyboard)) {
    out.inline_keyboard = markup.inline_keyboard
      .map(function (row) {
        if (!Array.isArray(row)) return null;
        return row
          .map(function (b) {
            if (!b || typeof b !== 'object') return null;
            const nb = { text: String(b.text || '•') };
            if (b.callback_data) nb.callback_data = String(b.callback_data);
            if (b.style) nb.style = String(b.style);
            if (b.url) nb.url = String(b.url);
            return nb;
          })
          .filter(Boolean);
      })
      .filter(function (r) {
        return r && r.length;
      });
  }
  if (Array.isArray(markup.keyboard)) {
    out.keyboard = markup.keyboard.map(function (row) {
      return (row || []).map(function (b) {
        if (typeof b === 'string') return { text: b };
        return { text: String((b && b.text) || '•') };
      });
    });
  }
  return out;
}

export function userKeyboard() {
  return sanitizeMarkup({
    keyboard: [[{ text: '🟢 ارسال پیام' }]],
    resize_keyboard: true,
  });
}

export function ownerKeyboard(botOn) {
  const on = botOn !== false;
  return sanitizeMarkup({
    keyboard: [
      [{ text: '📬 پیام‌های خوانده‌نشده' }, { text: '📂 پیام‌های قبلی' }],
      [{ text: '👥 مشاهده کاربران' }, { text: '🔍 جستجوی کاربر' }],
      [{ text: on ? '🔴 خاموش کردن ربات' : '🟢 روشن کردن ربات' }],
    ],
    resize_keyboard: true,
  });
}

export function messageActionsInline(msgId, userId) {
  return sanitizeMarkup({
    inline_keyboard: [
      [
        { text: '👁 مشاهده کاربر', callback_data: 'vu:' + userId, style: 'primary' },
        { text: '💬 پاسخ', callback_data: 'rp:' + msgId, style: 'success' },
      ],
      [{ text: '✅ خوانده شد', callback_data: 'rd:' + msgId }],
    ],
  });
}

export function backInline() {
  return sanitizeMarkup({
    inline_keyboard: [[{ text: '◀️ بازگشت', callback_data: 'back', style: 'danger' }]],
  });
}

export { sanitizeMarkup };
