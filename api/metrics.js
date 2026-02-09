export async function handleMetrics(request, env) {
  const data = await request.json();
  
  await env.DB.prepare(`
    INSERT INTO server_metrics 
    (server_id, cpu_usage, ram_usage, disk_usage, load_avg_1m, load_avg_5m, load_avg_15m,
     ram_total_mb, swap_usage, disk_wait, disk_read_bytes, disk_write_bytes,
     network_in_bytes, network_out_bytes, uptime_seconds, open_files, zombie_procs,
     top_proc, failed_services)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.server_id,
    data.cpu_usage,
    data.ram_usage,
    data.disk_usage,
    data.load_avg_1m,
    data.load_avg_5m,
    data.load_avg_15m,
    data.ram_total_mb,
    data.swap_usage,
    data.disk_wait,
    data.disk_read_bytes,
    data.disk_write_bytes,
    data.network_in_bytes,
    data.network_out_bytes,
    data.uptime_seconds,
    data.open_files,
    data.zombie_procs,
    JSON.stringify(data.top_proc),
    JSON.stringify(data.failed_services)
  ).run();
  
  // Обновляем статус сервера
  await env.DB.prepare(`
    UPDATE servers 
    SET status = 'online', last_seen_at = datetime('now')
    WHERE id = ?
  `).bind(data.server_id).run();
  
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}