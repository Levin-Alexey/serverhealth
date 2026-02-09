import { handleTelegram } from './telegram.js';
import { handleServersList } from './api/servers.js';
import { handleMetrics } from './api/metrics.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/webhook') {
      return handleTelegram(request, env);
    }

    if (url.pathname === '/api/servers/list') {
      return handleServersList(env);
    }

    if (url.pathname === '/api/metrics') {
      return handleMetrics(request, env);
    }

    // === ГРАФИК CPU ===
    if (url.pathname === '/chart/cpu') {
      const serverId = url.searchParams.get('server_id');
      
      const metrics = await env.DB.prepare(`
        SELECT cpu_usage, created_at 
        FROM server_metrics 
        WHERE server_id = ? 
        ORDER BY created_at DESC 
        LIMIT 48
      `).bind(serverId).all();
      
      const server = await env.DB.prepare(
        'SELECT name FROM servers WHERE id = ?'
      ).bind(serverId).first();
      
      const timestamps = metrics.results.map(m => m.created_at).reverse();
      const values = metrics.results.map(m => m.cpu_usage).reverse();
      
      const hfResponse = await fetch('https://levinaleksey-server-monitoring-api.hf.space/chart/cpu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          server_name: server?.name || 'Server',
          timestamps: timestamps,
          values: values
        })
      });
      
      const html = await hfResponse.text();
      return new Response(html, { headers: { 'Content-Type': 'text/html' }});
    }

    // === ГРАФИК RAM ===
    if (url.pathname === '/chart/ram') {
      const serverId = url.searchParams.get('server_id');
      
      const metrics = await env.DB.prepare(`
        SELECT ram_usage, created_at 
        FROM server_metrics 
        WHERE server_id = ? 
        ORDER BY created_at DESC 
        LIMIT 48
      `).bind(serverId).all();
      
      const server = await env.DB.prepare(
        'SELECT name FROM servers WHERE id = ?'
      ).bind(serverId).first();
      
      const timestamps = metrics.results.map(m => m.created_at).reverse();
      const values = metrics.results.map(m => m.ram_usage).reverse();
      
      const hfResponse = await fetch('https://levinaleksey-server-monitoring-api.hf.space/chart/ram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          server_name: server?.name || 'Server',
          timestamps: timestamps,
          values: values
        })
      });
      
      const html = await hfResponse.text();
      return new Response(html, { headers: { 'Content-Type': 'text/html' }});
    }

    // === ГРАФИК DISK ===
    if (url.pathname === '/chart/disk') {
      const serverId = url.searchParams.get('server_id');
      
      const metrics = await env.DB.prepare(`
        SELECT disk_usage, created_at 
        FROM server_metrics 
        WHERE server_id = ? 
        ORDER BY created_at DESC 
        LIMIT 48
      `).bind(serverId).all();
      
      const server = await env.DB.prepare(
        'SELECT name FROM servers WHERE id = ?'
      ).bind(serverId).first();
      
      const timestamps = metrics.results.map(m => m.created_at).reverse();
      const values = metrics.results.map(m => m.disk_usage).reverse();
      
      const hfResponse = await fetch('https://levinaleksey-server-monitoring-api.hf.space/chart/disk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          server_name: server?.name || 'Server',
          timestamps: timestamps,
          values: values
        })
      });
      
      const html = await hfResponse.text();
      return new Response(html, { headers: { 'Content-Type': 'text/html' }});
    }

    // === ГРАФИК NETWORK ===
    if (url.pathname === '/chart/network') {
      const serverId = url.searchParams.get('server_id');
      
      const metrics = await env.DB.prepare(`
        SELECT network_in_bytes, network_out_bytes, created_at 
        FROM server_metrics 
        WHERE server_id = ? 
        ORDER BY created_at DESC 
        LIMIT 48
      `).bind(serverId).all();
      
      const server = await env.DB.prepare(
        'SELECT name FROM servers WHERE id = ?'
      ).bind(serverId).first();
      
      const timestamps = metrics.results.map(m => m.created_at).reverse();
      const netIn = metrics.results.map(m => m.network_in_bytes).reverse();
      const netOut = metrics.results.map(m => m.network_out_bytes).reverse();
      
      const hfResponse = await fetch('https://levinaleksey-server-monitoring-api.hf.space/chart/network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          server_name: server?.name || 'Server',
          timestamps: timestamps,
          in: netIn,
          out: netOut
        })
      });
      
      const html = await hfResponse.text();
      return new Response(html, { headers: { 'Content-Type': 'text/html' }});
    }

    // === ГРАФИК OVERVIEW ===
    if (url.pathname === '/chart/overview') {
      const serverId = url.searchParams.get('server_id');
      
      const metrics = await env.DB.prepare(`
        SELECT cpu_usage, ram_usage, disk_usage, created_at 
        FROM server_metrics 
        WHERE server_id = ? 
        ORDER BY created_at DESC 
        LIMIT 48
      `).bind(serverId).all();
      
      const server = await env.DB.prepare(
        'SELECT name FROM servers WHERE id = ?'
      ).bind(serverId).first();
      
      const timestamps = metrics.results.map(m => m.created_at).reverse();
      const cpu = metrics.results.map(m => m.cpu_usage).reverse();
      const ram = metrics.results.map(m => m.ram_usage).reverse();
      const disk = metrics.results.map(m => m.disk_usage).reverse();
      
      const hfResponse = await fetch('https://levinaleksey-server-monitoring-api.hf.space/chart/overview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          server_name: server?.name || 'Server',
          timestamps: timestamps,
          cpu: cpu,
          ram: ram,
          disk: disk
        })
      });
      
      const html = await hfResponse.text();
      return new Response(html, { headers: { 'Content-Type': 'text/html' }});
    }

    // === ПРЕДИКЦИЯ ДИСКА ===
    if (url.pathname === '/predict/disk') {
      const serverId = url.searchParams.get('server_id');
      
      const metrics = await env.DB.prepare(`
        SELECT disk_usage, created_at 
        FROM server_metrics 
        WHERE server_id = ? 
        ORDER BY created_at DESC 
        LIMIT 100
      `).bind(serverId).all();
      
      const values = metrics.results.map(m => m.disk_usage).reverse();
      
      const hfResponse = await fetch('https://levinaleksey-server-monitoring-api.hf.space/predict/disk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: values, total_gb: 100 })
      });
      
      const result = await hfResponse.json();
      return new Response(JSON.stringify(result), { 
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // === ПРЕДИКЦИЯ RAM ===
    if (url.pathname === '/predict/ram') {
      const serverId = url.searchParams.get('server_id');
      
      const metrics = await env.DB.prepare(`
        SELECT ram_usage, created_at 
        FROM server_metrics 
        WHERE server_id = ? 
        ORDER BY created_at DESC 
        LIMIT 100
      `).bind(serverId).all();
      
      const values = metrics.results.map(m => m.ram_usage).reverse();
      
      const hfResponse = await fetch('https://levinaleksey-server-monitoring-api.hf.space/predict/ram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: values })
      });
      
      const result = await hfResponse.json();
      return new Response(JSON.stringify(result), { 
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // === ДЕТЕКЦИЯ АНОМАЛИЙ ===
    if (url.pathname === '/anomaly/detect') {
      const serverId = url.searchParams.get('server_id');
      
      // Текущие метрики
      const current = await env.DB.prepare(`
        SELECT cpu_usage, ram_usage, disk_usage 
        FROM server_metrics 
        WHERE server_id = ? 
        ORDER BY created_at DESC 
        LIMIT 1
      `).bind(serverId).first();
      
      // История за последние 100 записей
      const history = await env.DB.prepare(`
        SELECT cpu_usage, ram_usage, disk_usage 
        FROM server_metrics 
        WHERE server_id = ? 
        ORDER BY created_at DESC 
        LIMIT 100
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
      return new Response(JSON.stringify(result), { 
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not found', { status: 404 });
  }
};