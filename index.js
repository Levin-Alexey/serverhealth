// Telegram bot on Cloudflare Worker: /start -> "Привет, я бот"
const TELEGRAM_API = 'https://api.telegram.org/bot';

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
