export default async function handleAnalytics() {
	return {
		text: 'Раздел "Аналитика" — заглушка, логика будет позже.',
		replyMarkup: {
			inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'back_to_menu' }]]
		}
	};
}
