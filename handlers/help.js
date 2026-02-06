export default async function handleHelp() {
	return {
		text: 'Раздел "Помощь" — заглушка, логика будет позже.',
		replyMarkup: {
			inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'back_to_menu' }]]
		}
	};
}
