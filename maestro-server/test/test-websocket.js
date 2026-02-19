const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3000');

ws.on('open', () => {
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
});

ws.on('close', () => {
  process.exit(0);
});

ws.on('error', (err) => {
  process.exit(1);
});
