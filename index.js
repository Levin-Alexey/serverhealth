// Telegram bot on Cloudflare Worker: /start -> "Привет, я бот"
const TELEGRAM_API = 'https://api.telegram.org/bot';
const ALLOWED_USER_ID = 525944420;

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
				await sendMessage(BOT_TOKEN, chatId, 'Привет, я бот');
			}

			return new Response('OK', { status: 200 });
		} catch (error) {
			console.error('Error:', error);
			return new Response('Error processing request', { status: 500 });
		}
	}
};

async function sendMessage(token, chatId, text) {
	const url = `${TELEGRAM_API}${token}/sendMessage`;

	await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			chat_id: chatId,
			text
		})
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
