export default async function handleAnalytics(env) {
  // Получаем список серверов из D1
  const servers = await env.DB.prepare(
    'SELECT id, name, status FROM servers'
  ).all();
  
  // Делаем кнопки из серверов
  const serverButtons = servers.results.map(server => [{
    text: `${server.status === 'online' ? '🟢' : '🔴'} ${server.name}`,
    callback_data: `analytics_server_${server.id}`
  }]);
  
  // Добавляем кнопку назад
  serverButtons.push([{ text: '⬅️ Назад', callback_data: 'back_to_menu' }]);
  
  return {
    text: '🤖 Аналитика ИИ\n\nВыберите сервер для анализа:',
    replyMarkup: {
      inline_keyboard: serverButtons
    }
  };
}

// Получить метрики сервера
async function getServerMetrics(serverId, env) {
  const server = await env.DB.prepare(
    'SELECT name FROM servers WHERE id = ?'
  ).bind(serverId).first();

  const lastMetric = await env.DB.prepare(`
    SELECT * FROM server_metrics 
    WHERE server_id = ? 
    ORDER BY created_at DESC LIMIT 1
  `).bind(serverId).first();

  const history = await env.DB.prepare(`
    SELECT cpu_usage, ram_usage, disk_usage, created_at 
    FROM server_metrics 
    WHERE server_id = ? 
    ORDER BY created_at DESC LIMIT 48
  `).bind(serverId).all();

  const cpuValues = history.results.map(m => m.cpu_usage);
  const ramValues = history.results.map(m => m.ram_usage);
  const diskValues = history.results.map(m => m.disk_usage);

  return {
    server_name: server?.name || 'Unknown',
    current: {
      cpu: lastMetric?.cpu_usage || 0,
      ram: lastMetric?.ram_usage || 0,
      disk: lastMetric?.disk_usage || 0,
      load_1m: lastMetric?.load_avg_1m || 0,
      load_5m: lastMetric?.load_avg_5m || 0,
      load_15m: lastMetric?.load_avg_15m || 0,
      uptime_days: Math.floor((lastMetric?.uptime_seconds || 0) / 86400),
      zombie_procs: lastMetric?.zombie_procs || 0
    },
    stats: {
      cpu: {
        min: Math.min(...cpuValues),
        max: Math.max(...cpuValues),
        avg: (cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length).toFixed(1)
      },
      ram: {
        min: Math.min(...ramValues),
        max: Math.max(...ramValues),
        avg: (ramValues.reduce((a, b) => a + b, 0) / ramValues.length).toFixed(1)
      },
      disk: {
        min: Math.min(...diskValues),
        max: Math.max(...diskValues),
        avg: (diskValues.reduce((a, b) => a + b, 0) / diskValues.length).toFixed(1)
      }
    }
  };
}

// Сформировать системный промпт с метриками
function buildSystemPrompt(metrics) {
  return `Ты — эксперт по серверной инфраструктуре. Ты анализируешь сервер "${metrics.server_name}".

Текущие показатели сервера:
- CPU: ${metrics.current.cpu}% (мин: ${metrics.stats.cpu.min}%, макс: ${metrics.stats.cpu.max}%, среднее: ${metrics.stats.cpu.avg}%)
- RAM: ${metrics.current.ram}% (мин: ${metrics.stats.ram.min}%, макс: ${metrics.stats.ram.max}%, среднее: ${metrics.stats.ram.avg}%)
- Disk: ${metrics.current.disk}% (мин: ${metrics.stats.disk.min}%, макс: ${metrics.stats.disk.max}%, среднее: ${metrics.stats.disk.avg}%)
- Load Average: ${metrics.current.load_1m} / ${metrics.current.load_5m} / ${metrics.current.load_15m}
- Uptime: ${metrics.current.uptime_days} дней
- Zombie процессы: ${metrics.current.zombie_procs}

Отвечай на вопросы пользователя о сервере на русском языке. Будь краток и по делу.`;
}

// Запрос к ИИ
async function askAI(messages, env) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://serverhealth.busines-levin.workers.dev',
      'X-Title': 'Server Health Bot'
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3.5-sonnet',
      messages: messages,
      max_tokens: 500
    })
  });

  const result = await response.json();
  return result.choices?.[0]?.message?.content || 'Ошибка получения ответа от ИИ';
}

// Начало сессии анализа — создаём сессию в KV
export async function handleAnalyticsAI(serverId, userId, env) {
  const metrics = await getServerMetrics(serverId, env);
  const systemPrompt = buildSystemPrompt(metrics);

  // Первый запрос — общий анализ
  const initialPrompt = `Дай краткий анализ состояния сервера:
1. Общее состояние (🟢 хорошо / 🟡 внимание / 🔴 критично)
2. Выявленные проблемы (если есть)
3. Рекомендации (2-3 пункта)`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: initialPrompt }
  ];

  const aiResponse = await askAI(messages, env);

  // Сохраняем сессию в KV
  const sessionKey = `session_${userId}`;
  const sessionData = {
    server_id: serverId,
    server_name: metrics.server_name,
    metrics: metrics,
    messages: [
      { role: 'user', content: initialPrompt },
      { role: 'assistant', content: aiResponse }
    ],
    created_at: Date.now(),
    expires_at: Date.now() + 30 * 60 * 1000 // 30 минут
  };

  await env.KV.put(sessionKey, JSON.stringify(sessionData), {
    expirationTtl: 1800 // 30 минут в секундах
  });

  return {
    text: `🤖 Анализ ИИ — ${metrics.server_name}\n\n${aiResponse}\n\n💬 Задайте вопрос о сервере или нажмите "Завершить"`,
    replyMarkup: {
      inline_keyboard: [
        [{ text: '🔄 Обновить анализ', callback_data: `analytics_server_${serverId}` }],
        [{ text: '❌ Завершить диалог', callback_data: 'analytics_end' }]
      ]
    }
  };
}

// Обработка вопроса пользователя
export async function handleAnalyticsQuestion(userQuestion, sessionData, env) {
  const systemPrompt = buildSystemPrompt(sessionData.metrics);

  // Берём последние 10 сообщений для контекста
  const recentMessages = sessionData.messages.slice(-10);

  // Формируем массив сообщений для ИИ
  const messages = [
    { role: 'system', content: systemPrompt },
    ...recentMessages,
    { role: 'user', content: userQuestion }
  ];

  const aiResponse = await askAI(messages, env);

  // Обновляем сессию
  sessionData.messages.push(
    { role: 'user', content: userQuestion },
    { role: 'assistant', content: aiResponse }
  );

  // Ограничиваем историю 10 сообщениями
  if (sessionData.messages.length > 10) {
    sessionData.messages = sessionData.messages.slice(-10);
  }

  // Продлеваем сессию
  sessionData.expires_at = Date.now() + 30 * 60 * 1000;

  // Сохраняем обновлённую сессию
  const sessionKey = `session_${sessionData.user_id || '525944420'}`;
  await env.KV.put(sessionKey, JSON.stringify(sessionData), {
    expirationTtl: 1800
  });

  return {
    text: `🤖 ${sessionData.server_name}\n\n${aiResponse}`,
    replyMarkup: {
      inline_keyboard: [
        [{ text: '❌ Завершить диалог', callback_data: 'analytics_end' }]
      ]
    }
  };
}

// Завершение сессии
export async function handleAnalyticsEnd(userId, env) {
  const sessionKey = `session_${userId}`;
  await env.KV.delete(sessionKey);

  return {
    text: '✅ Диалог завершён.\n\nВыберите действие:',
    replyMarkup: {
      inline_keyboard: [
        [{ text: '🤖 Новый анализ', callback_data: 'analytics' }],
        [{ text: '⬅️ Главное меню', callback_data: 'back_to_menu' }]
      ]
    }
  };
}