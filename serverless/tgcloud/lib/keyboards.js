function sanitizeMarkup(markup) {
  if (!markup || typeof markup !== 'object') return markup;
  const out = {};
  if (markup.resize_keyboard != null) out.resize_keyboard = !!markup.resize_keyboard;
  if (markup.one_time_keyboard != null) out.one_time_keyboard = !!markup.one_time_keyboard;
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
            if (b.callback_data != null) nb.callback_data = String(b.callback_data);
            if (b.style) {
              const st = String(b.style).toLowerCase();
              if (st === 'primary' || st === 'success' || st === 'danger') nb.style = st;
            }
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

/** کاربر: دکمه اینلاین سبز (style=success) — رنگ دارد، بدون ایموجی */
export function userStartInline() {
  return sanitizeMarkup({
    inline_keyboard: [[{ text: 'ارسال پیام', callback_data: 'user_send', style: 'success' }]],
  });
}

export function userKeyboard() {
  return sanitizeMarkup({
    keyboard: [[{ text: 'ارسال پیام' }]],
    resize_keyboard: true,
  });
}

export function backKeyboard() {
  return sanitizeMarkup({
    keyboard: [[{ text: 'بازگشت' }]],
    resize_keyboard: true,
  });
}

export function ownerKeyboard(botOn) {
  const on = botOn !== false;
  return sanitizeMarkup({
    keyboard: [
      [{ text: 'پیام‌های خوانده‌نشده' }, { text: 'پیام‌های قبلی' }],
      [{ text: 'مشاهده کاربران' }, { text: 'جستجوی کاربر' }],
      [{ text: on ? 'خاموش کردن ربات' : 'روشن کردن ربات' }],
    ],
    resize_keyboard: true,
  });
}

export function messageActionsInline(msgId, userId) {
  return sanitizeMarkup({
    inline_keyboard: [
      [
        { text: 'مشاهده کاربر', callback_data: 'vu:' + userId, style: 'primary' },
        { text: 'پاسخ', callback_data: 'rp:' + msgId, style: 'success' },
      ],
      [{ text: 'خوانده شد', callback_data: 'rd:' + msgId, style: 'danger' }],
    ],
  });
}

export function backInline() {
  return sanitizeMarkup({
    inline_keyboard: [[{ text: 'بازگشت', callback_data: 'back', style: 'danger' }]],
  });
}

export { sanitizeMarkup };
