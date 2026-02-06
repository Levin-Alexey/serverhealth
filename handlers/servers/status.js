export default async function handleServersStatus() {
	return {
		text: 'Статус сервера — заглушка, логика будет позже.',
		replyMarkup: {
			inline_keyboard: [[{ text: '← Назад', callback_data: 'servers' }]]
		}
	};
}
