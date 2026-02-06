export default async function handleMetrics() {
	return {
		text: 'Раздел "Метрики" — заглушка, логика будет позже.',
		replyMarkup: {
			inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'back_to_menu' }]]
		}
	};
}
