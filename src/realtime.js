import game from './app.js';

const connections = new Set();

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

function openSocket() {
  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);
  server.accept();
  connections.add(server);
  const remove = () => connections.delete(server);
  server.addEventListener('close', remove);
  server.addEventListener('error', remove);
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
      socket.onmessage=event=>{try{const message=JSON.parse(event.data);if(message.type==='state-changed')tick()}catch{}};
      socket.onclose=()=>{realtimeRetry=setTimeout(connectRealtime,1500)};
      socket.onerror=()=>socket.close();
    }
    connectRealtime();
    setInterval(tick,10000)`
  );
}

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    if (url.pathname === '/api/ws') return openSocket();

    const response = await game.fetch(request, env, context);
    const isMutation = request.method === 'POST' && url.pathname.startsWith('/api/');
    if (isMutation && response.ok) notifyPlayers();

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
