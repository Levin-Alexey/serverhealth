export default async function handleSettings() {
	return {
		text: 'Раздел "Настройки" — заглушка, логика будет позже.',
		replyMarkup: {
			inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'back_to_menu' }]]
		}
	};
}
