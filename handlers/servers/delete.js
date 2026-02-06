export default async function handleServersDelete() {
	return {
		text: 'Удалить сервер — заглушка, логика будет позже.',
		replyMarkup: {
			inline_keyboard: [[{ text: '← Назад', callback_data: 'servers' }]]
		}
	};
}
