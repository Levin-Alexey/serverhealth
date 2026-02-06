export default async function handleServersAdd() {
	return {
		text: 'Добавить сервер — заглушка, логика будет позже.',
		replyMarkup: {
			inline_keyboard: [[{ text: '← Назад', callback_data: 'servers' }]]
		}
	};
}
