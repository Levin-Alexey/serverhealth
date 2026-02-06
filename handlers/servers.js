export default async function handleServers() {
	return {
		text: 'Серверы',
		replyMarkup: {
			inline_keyboard: [
				[{ text: '📋 Список серверов', callback_data: 'servers_list' }],
				[{ text: '➕ Добавить сервер', callback_data: 'servers_add' }],
				[{ text: '🔍 Статус сервера', callback_data: 'servers_status' }],
				[{ text: '🗑 Удалить сервер', callback_data: 'servers_delete' }],
				[{ text: '← Назад', callback_data: 'back_to_menu' }]
			]
		}
	};
}
