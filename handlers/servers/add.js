const SERVER_ADD_STEPS = ['name', 'host', 'description', 'ssh_user', 'ssh_password', 'ssh_port'];
const INLINE_KEYS = {
	SERVERS_ADD_CANCEL: 'servers_add_cancel'
};

export function isCancelText(text) {
	const normalized = text.toLowerCase();
	return normalized === '/cancel' || normalized === 'отмена' || normalized === 'cancel';
}

function isSkipText(text) {
	const normalized = text.toLowerCase();
	return normalized === '-' || normalized === 'пропустить' || normalized === 'skip';
}

function getServerAddPrompt(step) {
	switch (step) {
		case 'name':
			return 'Введите название сервера (уникальное):';
		case 'host':
			return 'Введите хост сервера (IP или домен):';
		case 'description':
			return 'Описание сервера (можно отправить "-", чтобы пропустить):';
		case 'ssh_user':
			return 'Введите SSH пользователя:';
		case 'ssh_password':
			return 'Введите SSH пароль (можно отправить "-", чтобы пропустить):';
		case 'ssh_port':
			return 'Введите SSH порт (по умолчанию 22, можно отправить "-"):';
		default:
			return 'Введите значение:';
	}
}

function getServerAddReplyMarkup() {
	return {
		inline_keyboard: [[{ text: 'Отмена', callback_data: INLINE_KEYS.SERVERS_ADD_CANCEL }]]
	};
}

async function ensureServerAddSessionTable(db) {
	if (!db) return;
	await db
		.prepare(
			'CREATE TABLE IF NOT EXISTS server_add_sessions (telegram_id INTEGER PRIMARY KEY, step TEXT NOT NULL, data TEXT, updated_at TEXT DEFAULT (datetime(\'now\')) )'
		)
		.run();
}

async function getServerAddSession(db, telegramId) {
	if (!db || !telegramId) return null;
	await ensureServerAddSessionTable(db);
	const row = await db
		.prepare('SELECT step, data FROM server_add_sessions WHERE telegram_id = ?')
		.bind(telegramId)
		.first();
	if (!row) return null;
	let data = {};
	try {
		data = row.data ? JSON.parse(row.data) : {};
	} catch {
		data = {};
	}
	return { step: row.step, data };
}

async function updateServerAddSession(db, telegramId, step, data) {
	if (!db || !telegramId) return;
	await db
		.prepare('INSERT INTO server_add_sessions (telegram_id, step, data) VALUES (?, ?, ?) ON CONFLICT(telegram_id) DO UPDATE SET step = excluded.step, data = excluded.data, updated_at = datetime(\'now\')')
		.bind(telegramId, step, JSON.stringify(data))
		.run();
}

export async function cancelServerAddFlow(db, telegramId) {
	if (!db || !telegramId) return;
	await ensureServerAddSessionTable(db);
	await db
		.prepare('DELETE FROM server_add_sessions WHERE telegram_id = ?')
		.bind(telegramId)
		.run();
}

function getNextStep(currentStep) {
	const index = SERVER_ADD_STEPS.indexOf(currentStep);
	if (index === -1 || index + 1 >= SERVER_ADD_STEPS.length) return null;
	return SERVER_ADD_STEPS[index + 1];
}

export default async function handleServersAdd({ token, chatId, user, db, sendMessage }) {
	if (!db || !user?.id) return;
	await ensureServerAddSessionTable(db);
	await db
		.prepare('INSERT INTO server_add_sessions (telegram_id, step, data) VALUES (?, ?, ?) ON CONFLICT(telegram_id) DO UPDATE SET step = excluded.step, data = excluded.data, updated_at = datetime(\'now\')')
		.bind(user.id, SERVER_ADD_STEPS[0], JSON.stringify({}))
		.run();

	await sendMessage(token, chatId, getServerAddPrompt(SERVER_ADD_STEPS[0]), getServerAddReplyMarkup());
}

export async function handleServersAddMessage({ token, chatId, user, text, db, sendMessage, onComplete }) {
	const session = await getServerAddSession(db, user.id);
	if (!session) return;

	const step = session.step;
	const data = session.data ?? {};

	if (step === 'name') {
		const name = text.trim();
		if (!name) {
			await sendMessage(token, chatId, 'Название не может быть пустым. Попробуйте ещё раз.', getServerAddReplyMarkup());
			return;
		}
		data.name = name;
	}

	if (step === 'host') {
		const host = text.trim();
		if (!host) {
			await sendMessage(token, chatId, 'Хост не может быть пустым. Попробуйте ещё раз.', getServerAddReplyMarkup());
			return;
		}
		data.host = host;
	}

	if (step === 'description') {
		data.description = isSkipText(text) ? null : text.trim();
	}

	if (step === 'ssh_user') {
		const sshUser = text.trim();
		if (!sshUser) {
			await sendMessage(token, chatId, 'SSH пользователь не может быть пустым. Попробуйте ещё раз.', getServerAddReplyMarkup());
			return;
		}
		data.ssh_user = sshUser;
	}

	if (step === 'ssh_password') {
		data.ssh_password = isSkipText(text) ? null : text.trim();
	}

	if (step === 'ssh_port') {
		if (isSkipText(text)) {
			data.ssh_port = 22;
		} else {
			const port = Number.parseInt(text.trim(), 10);
			if (!Number.isInteger(port) || port <= 0 || port > 65535) {
				await sendMessage(token, chatId, 'Некорректный порт. Введите число от 1 до 65535 или отправьте "-".', getServerAddReplyMarkup());
				return;
			}
			data.ssh_port = port;
		}
	}

	const nextStep = getNextStep(step);
	if (nextStep) {
		await updateServerAddSession(db, user.id, nextStep, data);
		await sendMessage(token, chatId, getServerAddPrompt(nextStep), getServerAddReplyMarkup());
		return;
	}

	try {
		// Ensure servers table exists
		await db
			.prepare(`
				CREATE TABLE IF NOT EXISTS servers (
					id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
					name TEXT NOT NULL UNIQUE,
					host TEXT NOT NULL,
					description TEXT,
					ssh_user TEXT NOT NULL,
					ssh_password TEXT,
					ssh_port INTEGER DEFAULT 22,
					status TEXT DEFAULT 'pending',
					last_seen_at TEXT,
					created_at TEXT DEFAULT (datetime('now'))
				)
			`)
			.run();

		await db
			.prepare(
				'INSERT INTO servers (name, host, description, ssh_user, ssh_password, ssh_port) VALUES (?, ?, ?, ?, ?, ?)'
			)
			.bind(
				data.name,
				data.host,
				data.description ?? null,
				data.ssh_user,
				data.ssh_password ?? null,
				data.ssh_port ?? 22
			)
			.run();
		await cancelServerAddFlow(db, user.id);
		await sendMessage(token, chatId, 'Сервер добавлен.');
		if (onComplete) {
			await onComplete();
		}
	} catch (error) {
		const message = String(error?.message ?? error);
		if (message.includes('UNIQUE constraint failed: servers.name')) {
			await updateServerAddSession(db, user.id, 'name', data);
			await sendMessage(token, chatId, 'Сервер с таким названием уже существует. Введите другое название:', getServerAddReplyMarkup());
			return;
		}

		await sendMessage(token, chatId, 'Не удалось сохранить сервер. Попробуйте ещё раз позже.');
	}
}
