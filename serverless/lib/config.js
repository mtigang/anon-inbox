export const OWNER_IDS = [8614252090, 8434360251];

export const WELCOME_USER =
  'سلام 👋\nبه ربات پیام ناشناس خوش آمدید.\n\nبا دکمه زیر می‌توانید پیام خود را برای مالک ارسال کنید.';

export const WELCOME_OWNER =
  'سلام مالک 👑\nاز منوی زیر پیام‌ها را مدیریت کنید.';

export function isOwner(userId) {
  return OWNER_IDS.includes(Number(userId));
}
