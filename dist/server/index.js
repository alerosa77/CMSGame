import game from './app.js';

const connections = new Set();
let realtimeReady = false;

async function ensureRealtime(env) {
  if (realtimeReady) return;
  await env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS realtime_version (id INTEGER PRIMARY KEY CHECK (id = 1), version INTEGER NOT NULL DEFAULT 0)'),
    env.DB.prepare('INSERT OR IGNORE INTO realtime_version (id, version) VALUES (1, 0)'),
  ]);
  realtimeReady = true;
}

async function readVersion(env) {
  await ensureRealtime(env);
  const row = await env.DB.prepare('SELECT version FROM realtime_version WHERE id = 1').first();
  return row?.version ?? 0;
}

async function bumpVersion(env) {
  await ensureRealtime(env);
  await env.DB.prepare('UPDATE realtime_version SET version = version + 1 WHERE id = 1').run();
}

function notifyPlayers() {
  const message = JSON.stringify({ type: 'state-changed', at: Date.now() });
  for (const socket of connections) {
    try {
      socket.send(message);
    } catch {
      connections.delete(socket);
    }
  }
}

function openSocket(request, env) {
  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);
  server.accept();
  connections.add(server);
  let lastVersion = null;
  const remove = () => connections.delete(server);
  server.addEventListener('close', remove);
  server.addEventListener('error', remove);
  server.addEventListener('message', async event => {
    if (event.data !== 'sync') return;
    try {
      const version = await readVersion(env);
      if (lastVersion !== null && version !== lastVersion) {
        server.send(JSON.stringify({ type: 'state-changed', at: Date.now() }));
      }
      lastVersion = version;
    } catch {
      server.send(JSON.stringify({ type: 'sync-error' }));
    }
  });
  server.send(JSON.stringify({ type: 'connected' }));
  return new Response(null, { status: 101, webSocket: client });
}

function addRealtimeClient(html) {
  return html.replace(
    'tick();setInterval(tick,1400)',
    `tick();
    let realtimeRetry;
    function connectRealtime(){
      clearTimeout(realtimeRetry);
      const protocol=location.protocol==='https:'?'wss':'ws';
      const socket=new WebSocket(protocol+'://'+location.host+'/api/ws');
      let syncTimer;
      socket.onopen=()=>{syncTimer=setInterval(()=>{if(socket.readyState===WebSocket.OPEN)socket.send('sync')},700)};
      socket.onmessage=event=>{try{const message=JSON.parse(event.data);if(message.type==='state-changed')tick()}catch{}};
      socket.onclose=()=>{clearInterval(syncTimer);realtimeRetry=setTimeout(connectRealtime,1500)};
      socket.onerror=()=>socket.close();
    }
    connectRealtime();
    setInterval(tick,10000)`
  ).replace(
    '</body>',
    `<script>
    document.addEventListener('click',async event=>{
      const button=event.target.closest('#start');
      if(!button)return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const previousLabel=button.textContent;
      button.disabled=true;
      button.textContent=previousLabel==='Começar jogo'?'Começando…':'Avançando…';
      try{
        const response=await fetch('/api/host/next',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
        if(!response.ok)throw new Error('Falha ao avançar');
        await tick();
      }catch{
        button.disabled=false;
        button.textContent='Tentar novamente';
      }
    },true);
    </script></body>`
  );
}

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    if (url.pathname === '/api/ws') return openSocket(request, env);

    const response = await game.fetch(request, env, context);
    const isMutation = request.method === 'POST' && url.pathname.startsWith('/api/');
    if (isMutation && response.ok) {
      await bumpVersion(env);
      notifyPlayers();
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return response;

    const headers = new Headers(response.headers);
    headers.set('cache-control', 'no-store');
    return new Response(addRealtimeClient(await response.text()), {
      status: response.status,
      headers,
    });
  },
};
