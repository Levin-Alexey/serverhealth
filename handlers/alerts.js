export default async function handleAlerts() {
	return {
		text: 'Раздел "Алерты" — заглушка, логика будет позже.',
		replyMarkup: {
			inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'back_to_menu' }]]
		}
	};
}
