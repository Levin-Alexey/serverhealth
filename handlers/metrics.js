export default async function handleMetrics(env) {
  // Получаем список серверов из D1
  const servers = await env.DB.prepare(
    'SELECT id, name, status FROM servers'
  ).all();
  
  // Делаем кнопки из серверов
  const serverButtons = servers.results.map(server => [{
    text: `${server.status === 'online' ? '🟢' : '🔴'} ${server.name}`,
    callback_data: `metrics_server_${server.id}`
  }]);
  
  // Добавляем кнопку назад
  serverButtons.push([{ text: '⬅️ Назад', callback_data: 'back_to_menu' }]);
  
  return {
    text: '📊 Выберите сервер:',
    replyMarkup: {
      inline_keyboard: serverButtons
    }
  };
}

export async function handleChartLink(chartType, serverId, env) {
  const server = await env.DB.prepare(
    'SELECT name FROM servers WHERE id = ?'
  ).bind(serverId).first();
  
  const baseUrl = 'https://serverhealth.busines-levin.workers.dev';
  const chartUrl = `${baseUrl}/chart/${chartType}?server_id=${serverId}`;
  
  const titles = {
    cpu: '💻 CPU',
    ram: '🧠 RAM',
    disk: '💾 Disk',
    network: '🌐 Network',
    overview: '📈 Overview'
  };
  
  const serverName = server?.name || 'Server';

  return {
    text: `📊 ${titles[chartType]} — ${serverName}\n\nНажмите кнопку чтобы открыть график:`,
    replyMarkup: {
      inline_keyboard: [
        [{ text: '📈 Открыть график', url: chartUrl }],
        [{ text: '⬅️ Назад', callback_data: `metrics_server_${serverId}` }]
      ]
    }
  };
}

export async function handleMetricsSelectType(serverId, env) {
  const server = await env.DB.prepare(
    'SELECT name FROM servers WHERE id = ?'
  ).bind(serverId).first();

  const serverName = server?.name || 'Server';
  
  return {
    text: `📊 Сервер: ${serverName}\n\nВыберите действие:`,
    replyMarkup: {
      inline_keyboard: [
        [
          { text: '💻 CPU', callback_data: `chart_cpu_${serverId}` },
          { text: '🧠 RAM', callback_data: `chart_ram_${serverId}` }
        ],
        [
          { text: '💾 Disk', callback_data: `chart_disk_${serverId}` },
          { text: '🌐 Network', callback_data: `chart_network_${serverId}` }
        ],
        [
          { text: '📈 Overview', callback_data: `chart_overview_${serverId}` }
        ],
        [
          { text: '🔮 Предикция диска', callback_data: `predict_disk_${serverId}` },
          { text: '🔮 Предикция RAM', callback_data: `predict_ram_${serverId}` }
        ],
        [
          { text: '🚨 Проверка аномалий', callback_data: `anomaly_${serverId}` }
        ],
        [{ text: '⬅️ Назад', callback_data: 'metrics' }]
      ]
    }
  };
}

// Предикция диска
export async function handlePredictDisk(serverId, env) {
  const server = await env.DB.prepare(
    'SELECT name FROM servers WHERE id = ?'
  ).bind(serverId).first();

  const metrics = await env.DB.prepare(`
    SELECT disk_usage FROM server_metrics 
    WHERE server_id = ? 
    ORDER BY created_at DESC LIMIT 100
  `).bind(serverId).all();

  const values = metrics.results.map(m => m.disk_usage).reverse();

  const hfResponse = await fetch('https://levinaleksey-server-monitoring-api.hf.space/predict/disk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: values, total_gb: 100 })
  });

  const result = await hfResponse.json();

  let text = `🔮 Предикция диска — ${server.name}\n\n`;
  text += `📊 Текущее использование: ${result.current_usage}%\n`;
  text += `📈 Рост в день: ${result.daily_growth}%\n`;
  text += `⏰ ${result.message}`;

  return {
    text: text,
    replyMarkup: {
      inline_keyboard: [
        [{ text: '⬅️ Назад', callback_data: `metrics_server_${serverId}` }]
      ]
    }
  };
}

// Предикция RAM
export async function handlePredictRam(serverId, env) {
  const server = await env.DB.prepare(
    'SELECT name FROM servers WHERE id = ?'
  ).bind(serverId).first();

  const metrics = await env.DB.prepare(`
    SELECT ram_usage FROM server_metrics 
    WHERE server_id = ? 
    ORDER BY created_at DESC LIMIT 100
  `).bind(serverId).all();

  const values = metrics.results.map(m => m.ram_usage).reverse();

  const hfResponse = await fetch('https://levinaleksey-server-monitoring-api.hf.space/predict/ram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: values })
  });

  const result = await hfResponse.json();

  let text = `🔮 Предикция RAM — ${server.name}\n\n`;
  text += `📊 Текущее использование: ${result.current_usage}%\n`;
  text += `📈 Тренд: ${result.trend}\n`;
  text += `💡 ${result.message}`;

  return {
    text: text,
    replyMarkup: {
      inline_keyboard: [
        [{ text: '⬅️ Назад', callback_data: `metrics_server_${serverId}` }]
      ]
    }
  };
}

// Детекция аномалий
export async function handleAnomalyDetect(serverId, env) {
  const server = await env.DB.prepare(
    'SELECT name FROM servers WHERE id = ?'
  ).bind(serverId).first();

  const current = await env.DB.prepare(`
    SELECT cpu_usage, ram_usage, disk_usage 
    FROM server_metrics 
    WHERE server_id = ? 
    ORDER BY created_at DESC LIMIT 1
  `).bind(serverId).first();

  const history = await env.DB.prepare(`
    SELECT cpu_usage, ram_usage, disk_usage 
    FROM server_metrics 
    WHERE server_id = ? 
    ORDER BY created_at DESC LIMIT 100
  `).bind(serverId).all();

  const hfResponse = await fetch('https://levinaleksey-server-monitoring-api.hf.space/anomaly/detect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      current: current,
      history: history.results 
    })
  });

  const result = await hfResponse.json();

  let text = `🚨 Проверка аномалий — ${server.name}\n\n`;
  
  if (result.anomalies && result.anomalies.length > 0) {
    text += `Статус: ⚠️ Обнаружены аномалии\n\n`;
    result.anomalies.forEach(a => {
      text += `• ${a.metric}: ${a.current}% (норма ~${a.mean}%)\n`;
      text += `  Уровень: ${a.severity}\n\n`;
    });
  } else if (result.status !== 'ok') {
    // Случай, когда общий статус плохой, но список аномалий пуст
    text += `Статус: ⚠️ Подозрительная активность\n\n`;
    text += `Обнаружено отклонение от паттерна поведения, но конкретные метрики в пределах допустимых границ.`;
  } else {
    text += `Статус: ✅ Норма\n\n`;
    text += `Все показатели в норме.`;
  }

  return {
    text: text,
    replyMarkup: {
      inline_keyboard: [
        [{ text: '⬅️ Назад', callback_data: `metrics_server_${serverId}` }]
      ]
    }
  };
}