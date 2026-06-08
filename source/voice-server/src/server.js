const http = require('node:http');
const path = require('node:path');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const config = require('./config');
const { VoiceService } = require('./voice-service');
const { registerSocketHandlers } = require('./socket-handlers');

async function main() {
  await config.resolvePublicIp();
  const app = express();
  app.use(cors({ origin: config.corsOrigin }));
  app.get('/healthz', (_request, response) => response.json({ ok: true }));
  app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: '1d' }));
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: config.corsOrigin, methods: ['GET', 'POST'] } });
  const voiceService = new VoiceService(config);
  await voiceService.start();
  registerSocketHandlers(io, voiceService);
  server.listen(config.port, '0.0.0.0', () => console.log(`VideoTogether voice SFU listening on :${config.port}`));
}

main().catch((error) => { console.error(error); process.exit(1); });
