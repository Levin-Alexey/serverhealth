export default async function handleServersList({ db, sendMessage, token, chatId }) {
	if (!db) {
		return {
			text: 'База данных недоступна',
			replyMarkup: {
				inline_keyboard: [[{ text: '← Назад', callback_data: 'servers' }]]
			}
		};
	}

	try {
		const servers = await db
			.prepare('SELECT id, name, host, status, last_seen_at FROM servers ORDER BY created_at DESC')
			.all();

		if (!servers || servers.results.length === 0) {
			return {
				text: 'Нет добавленных серверов.',
				replyMarkup: {
					inline_keyboard: [[{ text: '← Назад', callback_data: 'servers' }]]
				}
			};
		}

		let text = '📋 <b>Список серверов:</b>\n\n';
		
		servers.results.forEach((server, index) => {
			const statusEmoji = server.status === 'online' ? '🟢' : server.status === 'offline' ? '🔴' : '⚪';
			const lastSeen = server.last_seen_at ? new Date(server.last_seen_at).toLocaleDateString('ru-RU') : 'не проверен';
			
			text += `${index + 1}. ${statusEmoji} <b>${server.name}</b>\n`;
			text += `   Хост: ${server.host}\n`;
			text += `   Статус: ${server.status}\n`;
			text += `   Последняя проверка: ${lastSeen}\n\n`;
		});

		const inlineKeyboard = [
			[{ text: '← Назад', callback_data: 'servers' }]
		];

		return {
			text,
			replyMarkup: {
				inline_keyboard: inlineKeyboard
			},
			parse_mode: 'HTML'
		};
	} catch (error) {
		console.error('Error fetching servers:', error);
		return {
			text: 'Ошибка при загрузке списка серверов.',
			replyMarkup: {
				inline_keyboard: [[{ text: '← Назад', callback_data: 'servers' }]]
			}
		};
	}
}
