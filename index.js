// Telegram bot on Cloudflare Worker: /start -> "Привет, я бот"
import handleServers from './handlers/servers.js';
import handleServersList from './handlers/servers/list.js';
import handleServersAdd, {
	cancelServerAddFlow,
	handleServersAddMessage,
	isCancelText
} from './handlers/servers/add.js';
import handleServersStatus, { handleServersStatusCheck } from './handlers/servers/status.js';
import handleServersDelete, {
	handleServersDeleteConfirm,
	handleServersDeleteExecute
} from './handlers/servers/delete.js';
import handleMetrics from './handlers/metrics.js';
import handleAlerts from './handlers/alerts.js';
import handleAnalytics from './handlers/analytics.js';
import handleSettings from './handlers/settings.js';
import handleHelp from './handlers/help.js';

const TELEGRAM_API = 'https://api.telegram.org/bot';
const ALLOWED_USER_ID = 525944420;

const INLINE_KEYS = {
	SERVERS: 'servers',
	SERVERS_LIST: 'servers_list',
	SERVERS_ADD: 'servers_add',
	SERVERS_STATUS: 'servers_status',
	SERVERS_DELETE: 'servers_delete',
	SERVERS_ADD_CANCEL: 'servers_add_cancel',
	METRICS: 'metrics',
	ALERTS: 'alerts',
	ANALYTICS: 'analytics',
	SETTINGS: 'settings',
	HELP: 'help',
	BACK_TO_MENU: 'back_to_menu'
};

export default {
	async fetch(request, env) {
		const BOT_TOKEN = env.BOT_TOKEN;

		if (request.method !== 'POST') {
			return new Response('Bot is running', { status: 200 });
		}

		try {
			const update = await request.json();

			if (update?.message?.text === '/start') {
				const chatId = update.message.chat.id;
				const user = update.message.from;

				if (!isAllowedUser(user)) {
					await sendMessage(BOT_TOKEN, chatId, 'Доступ закрыт');
					return new Response('OK', { status: 200 });
				}

				await upsertUser(env.DB, user);
				await sendMainMenu(BOT_TOKEN, chatId);
			}

			if (update?.message?.text && update.message.text !== '/start') {
				const chatId = update.message.chat.id;
				const user = update.message.from;
				const text = update.message.text.trim();

				if (!isAllowedUser(user)) {
					await sendMessage(BOT_TOKEN, chatId, 'Доступ закрыт');
					return new Response('OK', { status: 200 });
				}

				if (isCancelText(text)) {
					await cancelServerAddFlow(env.DB, user.id);
					const { replyMarkup } = await handleServers();
					await sendMessage(BOT_TOKEN, chatId, 'Добавление сервера отменено.', replyMarkup);
					return new Response('OK', { status: 200 });
				}

				await handleServersAddMessage({
					token: BOT_TOKEN,
					chatId,
					user,
					text,
					db: env.DB,
					sendMessage,
					onComplete: async () => {
						const { replyMarkup } = await handleServers();
						await sendMessage(BOT_TOKEN, chatId, 'Возврат в меню серверов.', replyMarkup);
					}
				});
				return new Response('OK', { status: 200 });
			}

			if (update?.callback_query) {
				const chatId = update.callback_query.message.chat.id;
				const data = update.callback_query.data;
				const user = update.callback_query.from;

				if (!isAllowedUser(user)) {
					await sendMessage(BOT_TOKEN, chatId, 'Доступ закрыт');
					return new Response('OK', { status: 200 });
				}

				switch (true) {
					case data === INLINE_KEYS.SERVERS: {
						const { text, replyMarkup } = await handleServers();
						await sendMessage(BOT_TOKEN, chatId, text, replyMarkup);
						break;
					}
					case data === INLINE_KEYS.SERVERS_LIST: {
						const { text, replyMarkup, parse_mode } = await handleServersList({ db: env.DB, sendMessage, token: BOT_TOKEN, chatId });
						await sendMessage(BOT_TOKEN, chatId, text, replyMarkup, parse_mode);
						break;
					}
					case data === INLINE_KEYS.SERVERS_ADD: {
						await handleServersAdd({
							token: BOT_TOKEN,
							chatId,
							user,
							db: env.DB,
							sendMessage
						});
						break;
					}
					case data === INLINE_KEYS.SERVERS_STATUS: {
						const { text, replyMarkup, parse_mode } = await handleServersStatus({ db: env.DB });
						await sendMessage(BOT_TOKEN, chatId, text, replyMarkup, parse_mode);
						break;
					}
					case data.startsWith('servers_status_check_'): {
						const serverId = data.replace('servers_status_check_', '');
						const response = await handleServersStatusCheck({ db: env.DB, serverId });
						await sendMessage(BOT_TOKEN, chatId, response.text, response.replyMarkup, response.parse_mode);
						break;
					}
					case data === INLINE_KEYS.SERVERS_DELETE: {
						const { text, replyMarkup, parse_mode } = await handleServersDelete({ db: env.DB });
						await sendMessage(BOT_TOKEN, chatId, text, replyMarkup, parse_mode);
						break;
					}
					case data.startsWith('servers_delete_confirm_'): {
						const serverId = data.replace('servers_delete_confirm_', '');
						const response = await handleServersDeleteConfirm({ db: env.DB, serverId });
						if (response) {
							await sendMessage(BOT_TOKEN, chatId, response.text, response.replyMarkup, response.parse_mode);
						}
						break;
					}
					case data.startsWith('servers_delete_execute_'): {
						const serverId = data.replace('servers_delete_execute_', '');
						const response = await handleServersDeleteExecute({ db: env.DB, serverId });
						await sendMessage(BOT_TOKEN, chatId, response.text, response.replyMarkup, response.parse_mode);
						break;
					}
					case data === INLINE_KEYS.SERVERS_ADD_CANCEL: {
						await cancelServerAddFlow(env.DB, user.id);
						const { replyMarkup } = await handleServers();
						await sendMessage(BOT_TOKEN, chatId, 'Добавление сервера отменено.', replyMarkup);
						break;
					}
					case data === INLINE_KEYS.METRICS: {
						const { text, replyMarkup } = await handleMetrics();
						await sendMessage(BOT_TOKEN, chatId, text, replyMarkup);
						break;
					}
					case data === INLINE_KEYS.ALERTS: {
						const { text, replyMarkup } = await handleAlerts();
						await sendMessage(BOT_TOKEN, chatId, text, replyMarkup);
						break;
					}
					case data === INLINE_KEYS.ANALYTICS: {
						const { text, replyMarkup } = await handleAnalytics();
						await sendMessage(BOT_TOKEN, chatId, text, replyMarkup);
						break;
					}
					case data === INLINE_KEYS.SETTINGS: {
						const { text, replyMarkup } = await handleSettings();
						await sendMessage(BOT_TOKEN, chatId, text, replyMarkup);
						break;
					}
					case data === INLINE_KEYS.HELP: {
						const { text, replyMarkup } = await handleHelp();
						await sendMessage(BOT_TOKEN, chatId, text, replyMarkup);
						break;
					}
					case data === INLINE_KEYS.BACK_TO_MENU: {
						await sendMainMenu(BOT_TOKEN, chatId);
						break;
					}
					default:
						if (!data.startsWith('servers_delete_')) {
							await sendMessage(BOT_TOKEN, chatId, 'Неизвестная команда');
						}
				}
			}

			return new Response('OK', { status: 200 });
		} catch (error) {
			console.error('Error:', error);
			return new Response('Error processing request', { status: 500 });
		}
	}
};

async function sendMessage(token, chatId, text, replyMarkup, parse_mode) {
	const url = `${TELEGRAM_API}${token}/sendMessage`;
	const payload = {
		chat_id: chatId,
		text
	};

	if (replyMarkup) {
		payload.reply_markup = replyMarkup;
	}

	if (parse_mode) {
		payload.parse_mode = parse_mode;
	}

	await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(payload)
	});
}

async function sendMainMenu(token, chatId) {
	await sendMessage(token, chatId, 'Выберите раздел меню:', {
		inline_keyboard: [
			[
				{ text: '🖥 Серверы', callback_data: INLINE_KEYS.SERVERS },
				{ text: '📊 Метрики', callback_data: INLINE_KEYS.METRICS }
			],
			[
				{ text: '🔔 Алерты', callback_data: INLINE_KEYS.ALERTS },
				{ text: '📈 Аналитика', callback_data: INLINE_KEYS.ANALYTICS }
			],
			[
				{ text: '⚙️ Настройки', callback_data: INLINE_KEYS.SETTINGS },
				{ text: '❓ Помощь', callback_data: INLINE_KEYS.HELP }
			]
		]
	});
}

function isAllowedUser(user) {
	return user?.id === ALLOWED_USER_ID;
}

async function upsertUser(db, user) {
	if (!db || !user?.id) return;

	const telegramId = user.id;
	const username = user.username ?? null;
	const firstName = user.first_name ?? null;
	const now = Math.floor(Date.now() / 1000);

	const existing = await db
		.prepare('SELECT telegram_id FROM users WHERE telegram_id = ?')
		.bind(telegramId)
		.first();

	if (existing) {
		await db
			.prepare('UPDATE users SET last_seen = ?, username = ?, first_name = ? WHERE telegram_id = ?')
			.bind(now, username, firstName, telegramId)
			.run();
		return;
	}

	await db
		.prepare('INSERT INTO users (telegram_id, username, first_name, created_at, last_seen) VALUES (?, ?, ?, ?, ?)')
		.bind(telegramId, username, firstName, now, now)
		.run();
}

