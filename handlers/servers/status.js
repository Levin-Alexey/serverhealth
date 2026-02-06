export default async function handleServersStatus({ db }) {
	if (!db) {
		return {
			text: 'База данных недоступна',
			replyMarkup: {
				inline_keyboard: [[{ text: '← Назад', callback_data: 'servers' }]]
			}
		};
	}

	try {
		const servers = await db
			.prepare('SELECT id, name, host, status, last_seen_at FROM servers ORDER BY created_at DESC')
			.all();

		if (!servers || servers.results.length === 0) {
			return {
				text: 'Нет добавленных серверов.',
				replyMarkup: {
					inline_keyboard: [[{ text: '← Назад', callback_data: 'servers' }]]
				}
			};
		}

		const inlineKeyboard = servers.results.map((server) => [
			{
				text: `🔍 ${server.name}`,
				callback_data: `servers_status_check_${server.id}`
			}
		]);

		inlineKeyboard.push([{ text: '← Назад', callback_data: 'servers' }]);

		let text = '🔍 <b>Проверка статуса серверов:</b>\n\n';
		servers.results.forEach((server, index) => {
			const statusEmoji = server.status === 'online' ? '🟢' : server.status === 'offline' ? '🔴' : '⚪';
			const lastSeen = server.last_seen_at ? new Date(server.last_seen_at).toLocaleDateString('ru-RU') : 'не проверен';
			text += `${index + 1}. ${statusEmoji} <b>${server.name}</b>\n   ${server.host} | ${lastSeen}\n\n`;
		});

		text += '\nНажмите на сервер для проверки статуса';

		return {
			text,
			replyMarkup: {
				inline_keyboard: inlineKeyboard
			},
			parse_mode: 'HTML'
		};
	} catch (error) {
		console.error('Error fetching servers for status check:', error);
		return {
			text: 'Ошибка при загрузке списка серверов.',
			replyMarkup: {
				inline_keyboard: [[{ text: '← Назад', callback_data: 'servers' }]]
			}
		};
	}
}

export async function handleServersStatusCheck({ db, serverId }) {
	if (!db || !serverId) {
		return {
			text: 'Ошибка: сервер не найден.',
			replyMarkup: {
				inline_keyboard: [[{ text: '← Назад', callback_data: 'servers_status' }]]
			}
		};
	}

	try {
		const server = await db
			.prepare('SELECT id, name, host, ssh_port FROM servers WHERE id = ?')
			.bind(serverId)
			.first();

		if (!server) {
			return {
				text: 'Сервер не найден.',
				replyMarkup: {
					inline_keyboard: [[{ text: '← Назад', callback_data: 'servers_status' }]]
				}
			};
		}

		const port = server.ssh_port || 22;
		const status = await checkServerStatus(server.host, port);
		const now = new Date().toISOString();

		await db
			.prepare('UPDATE servers SET status = ?, last_seen_at = ? WHERE id = ?')
			.bind(status ? 'online' : 'offline', now, serverId)
			.run();

		const statusEmoji = status ? '🟢' : '🔴';
		const statusText = status ? 'в сети' : 'оффлайн';

		return {
			text: `${statusEmoji} <b>${server.name}</b>\n\n<b>Хост:</b> ${server.host}\n<b>Статус:</b> ${statusText}\n<b>Время проверки:</b> ${new Date(now).toLocaleString('ru-RU')}`,
			replyMarkup: {
				inline_keyboard: [[{ text: '← Назад', callback_data: 'servers_status' }]]
			},
			parse_mode: 'HTML'
		};
	} catch (error) {
		console.error('Error checking server status:', error);
		return {
			text: '⚠️ Ошибка при проверке статуса.',
			replyMarkup: {
				inline_keyboard: [[{ text: '← Назад', callback_data: 'servers_status' }]]
			},
			parse_mode: 'HTML'
		};
	}
}

async function checkServerStatus(host, port) {
	try {
		const timeout = 5000; // 5 секунд
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);

		const response = await fetch(`http://${host}:80`, {
			method: 'HEAD',
			signal: controller.signal,
			redirect: 'manual'
		});

		clearTimeout(timeoutId);
		return true;
	} catch (error) {
		// Если HTTP не работает, пробуем TCP подключение на SSH порт
		try {
			const timeout = 5000;
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), timeout);

			// В Cloudflare Worker нельзя напрямую проверять TCP
			// Используем стратегию: пробуем подключиться через fetch к common портам
			const ports = [443, 8080, 3000, 5000];
			
			for (const checkPort of ports) {
				try {
					const response = await fetch(`https://${host}:${checkPort}`, {
						method: 'HEAD',
						signal: controller.signal,
						redirect: 'manual'
					});
					clearTimeout(timeoutId);
					return true;
				} catch (e) {
					// Продолжаем проверку на других портах
				}
			}

			clearTimeout(timeoutId);
			return false;
		} catch (tcpError) {
			return false;
		}
	}
}
