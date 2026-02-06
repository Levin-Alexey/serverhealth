export default async function handleServersList() {
	return {
		text: 'Список серверов — заглушка, логика будет позже.',
		replyMarkup: {
			inline_keyboard: [[{ text: '← Назад', callback_data: 'servers' }]]
		}
	};
}
