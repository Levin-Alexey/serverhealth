export async function handleServersList(env) {
  const servers = await env.DB.prepare(
    'SELECT id, name, host, ssh_user, ssh_password, ssh_port FROM servers'
  ).all();
  
  return new Response(JSON.stringify(servers.results), {
    headers: { 'Content-Type': 'application/json' }
  });
}