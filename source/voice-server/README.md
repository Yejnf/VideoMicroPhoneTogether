# VideoTogether voice server

Audio-only Socket.IO + mediasoup SFU. See [`../../docs/zh-cn/voice-sfu.md`](../../docs/zh-cn/voice-sfu.md) for architecture, configuration, firewall rules, and deployment.

```bash
cp .env.example .env
npm install
npm run build
npm start
```

Before deployment, replace `ROOM_SECRET` in `.env` with a long random value. Set `ALLOW_OPEN_ROOMS=true` only if you intentionally want public voice rooms without a shared secret.
