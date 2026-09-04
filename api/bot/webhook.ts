// ==========================================
// POST /api/bot/webhook
// ==========================================
// Telegram Bot webhook handler (grammY).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Bot, webhookCallback } from 'grammy';
import { getDb } from '@crm/firebase-config';
import { COLLECTIONS } from '@crm/shared';

// Initialize bot
const botToken = process.env.TELEGRAM_BOT_TOKEN;
if (!botToken) {
  console.error('TELEGRAM_BOT_TOKEN not set');
}

const bot = new Bot(botToken || 'placeholder');

// Mini App URL (Vercel deployment URL)
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://crm-hookah.vercel.app';

// /start command handler
bot.command('start', async (ctx) => {
  const telegramId = ctx.from?.id;

  if (!telegramId) {
    await ctx.reply('Не удалось определить ваш Telegram ID.');
    return;
  }

  try {
    const db = getDb();

    // Find employee by telegram_id
    const snapshot = await db
      .collection(COLLECTIONS.EMPLOYEES)
      .where('telegram_id', '==', telegramId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      await ctx.reply(
        '❌ Доступ к CRM не предоставлен.\n\nОбратитесь к администратору.',
        { parse_mode: 'HTML' }
      );
      return;
    }

    const employee = snapshot.docs[0].data();

    if (!employee.is_active) {
      await ctx.reply(
        '❌ Ваш аккаунт деактивирован.\n\nОбратитесь к администратору.',
        { parse_mode: 'HTML' }
      );
      return;
    }

    await ctx.reply(
      `👋 Привет, <b>${employee.name}</b>!\n\nОткройте CRM для работы:`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '📱 Открыть CRM',
                web_app: { url: MINI_APP_URL },
              },
            ],
          ],
        },
      }
    );
  } catch (error) {
    console.error('Bot /start error:', error);
    await ctx.reply('Произошла ошибка. Попробуйте позже.');
  }
});

// Handle webhook
const handleWebhook = webhookCallback(bot, 'std/http');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify webhook secret (optional, from Telegram)
    const secretToken = req.headers['x-telegram-bot-api-secret-token'];
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

    if (expectedSecret && secretToken !== expectedSecret) {
      return res.status(403).json({ error: 'Invalid webhook secret' });
    }

    // Convert Vercel request to standard Request for grammY
    const url = `https://${req.headers.host}${req.url}`;
    const request = new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req.body),
    });

    const response = await handleWebhook(request);
    res.status(response.status).end();
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
}
