const INLINE_KEYS = {
	SERVERS_DELETE_CONFIRM: 'servers_delete_confirm_',
	SERVERS_DELETE_CANCEL: 'servers_delete_cancel_'
};

export default async function handleServersDelete({ db }) {
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
			.prepare('SELECT id, name, host, status FROM servers ORDER BY created_at DESC')
			.all();

		if (!servers || servers.results.length === 0) {
			return {
				text: 'Нет серверов для удаления.',
				replyMarkup: {
					inline_keyboard: [[{ text: '← Назад', callback_data: 'servers' }]]
				}
			};
		}

		const inlineKeyboard = servers.results.map((server) => [
			{
				text: `🗑 ${server.name}`,
				callback_data: `servers_delete_confirm_${server.id}`
			}
		]);

		inlineKeyboard.push([{ text: '← Назад', callback_data: 'servers' }]);

		let text = '🗑 <b>Выберите сервер для удаления:</b>\n\n';
		servers.results.forEach((server, index) => {
			const statusEmoji = server.status === 'online' ? '🟢' : server.status === 'offline' ? '🔴' : '⚪';
			text += `${index + 1}. ${statusEmoji} <b>${server.name}</b> (${server.host})\n`;
		});

		return {
			text,
			replyMarkup: {
				inline_keyboard: inlineKeyboard
			},
			parse_mode: 'HTML'
		};
	} catch (error) {
		console.error('Error fetching servers for deletion:', error);
		return {
			text: 'Ошибка при загрузке списка серверов.',
			replyMarkup: {
				inline_keyboard: [[{ text: '← Назад', callback_data: 'servers' }]]
			}
		};
	}
}

export async function handleServersDeleteConfirm({ db, serverId }) {
	if (!db || !serverId) return null;

	try {
		const server = await db
			.prepare('SELECT id, name, host FROM servers WHERE id = ?')
			.bind(serverId)
			.first();

		if (!server) {
			return null;
		}

		return {
			text: `⚠️ <b>Вы уверены, что хотите удалить сервер?</b>\n\n<b>Название:</b> ${server.name}\n<b>Хост:</b> ${server.host}\n\nЭто действие нельзя отменить!`,
			replyMarkup: {
				inline_keyboard: [
					[
						{ text: '❌ Удалить', callback_data: `servers_delete_execute_${serverId}` },
						{ text: '🚫 Отмена', callback_data: 'servers_delete' }
					]
				]
			},
			parse_mode: 'HTML'
		};
	} catch (error) {
		console.error('Error confirming deletion:', error);
		return null;
	}
}

export async function handleServersDeleteExecute({ db, serverId }) {
	if (!db || !serverId) {
		return {
			text: 'Ошибка: сервер не найден.',
			replyMarkup: {
				inline_keyboard: [[{ text: '← Назад', callback_data: 'servers' }]]
			}
		};
	}

	try {
		const server = await db
			.prepare('SELECT name FROM servers WHERE id = ?')
			.bind(serverId)
			.first();

		if (!server) {
			return {
				text: 'Сервер не найден.',
				replyMarkup: {
					inline_keyboard: [[{ text: '← Назад', callback_data: 'servers' }]]
				}
			};
		}

		await db
			.prepare('DELETE FROM servers WHERE id = ?')
			.bind(serverId)
			.run();

		return {
			text: `✅ Сервер "<b>${server.name}</b>" удалён.`,
			replyMarkup: {
				inline_keyboard: [[{ text: '← Назад', callback_data: 'servers' }]]
			},
			parse_mode: 'HTML'
		};
	} catch (error) {
		console.error('Error deleting server:', error);
		return {
			text: 'Не удалось удалить сервер. Попробуйте позже.',
			replyMarkup: {
				inline_keyboard: [[{ text: '← Назад', callback_data: 'servers' }]]
			}
		};
	}
}
