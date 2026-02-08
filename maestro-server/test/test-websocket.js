const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3000');

ws.on('open', () => {
  console.log('✅ Connected to WebSocket server');
  console.log('Listening for events...\n');
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log(`📨 Received event: ${msg.event}`);
  console.log(`   Data:`, JSON.stringify(msg.data, null, 2));
  console.log('');
});

ws.on('close', () => {
  console.log('❌ Disconnected from WebSocket server');
  process.exit(0);
});

ws.on('error', (err) => {
  console.error('WebSocket error:', err);
  process.exit(1);
});

// Keep the process alive
console.log('Starting WebSocket test client...');
console.log('Press Ctrl+C to exit\n');
