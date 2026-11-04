// ASTRA 2.0 — временная диагностика подключения D1.
// Замените этим кодом старый worker.js, Deploy, откройте /health.
// Секреты и ключи в этом файле не нужны.
const VERSION = 'ASTRA-PREFLIGHT-2.0';
export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (request.method !== 'GET' || !['/', '/health'].includes(path)) {
      return new Response('Not found', { status: 404 });
    }
    const info = {
      version: VERSION,
      db_binding: env.DB ? 'FOUND' : 'MISSING',
      db_query: 'NOT_TESTED',
      users_table: 'NOT_TESTED',
    };
    if (env.DB) {
      try {
        const test = await env.DB.prepare('SELECT 1 AS ok').first();
        info.db_query = test?.ok === 1 ? 'OK' : 'UNEXPECTED_RESULT';
        const table = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='astra_users'").first();
        info.users_table = table?.name === 'astra_users' ? 'FOUND' : 'MISSING';
      } catch (error) {
        info.db_query = 'ERROR';
        info.error = 'Database query failed. Check D1 binding in Production and database health.';
        console.error('Astra preflight DB error', error);
      }
    }
    info.ready = info.db_binding === 'FOUND' && info.db_query === 'OK' && info.users_table === 'FOUND';
    return new Response(JSON.stringify(info, null, 2), {
      headers: {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store'},
      status: info.ready ? 200 : 503,
    });
  },
};
