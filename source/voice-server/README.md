# VideoTogether voice server

Audio-only Socket.IO + mediasoup SFU. See [`../../docs/zh-cn/voice-sfu.md`](../../docs/zh-cn/voice-sfu.md) for architecture, configuration, firewall rules, and deployment.

```bash
cp .env.example .env
npm install
npm run build
npm start
```

Before deployment, replace `ROOM_SECRET` in `.env` with a long random value. Set `ALLOW_OPEN_ROOMS=true` only if you intentionally want public voice rooms without a shared secret.

For low-memory VPS deployments, prefer a prebuilt image instead of building mediasoup on the server:

```bash
cp .env.example .env
docker compose -f docker-compose.image.yml pull
docker compose -f docker-compose.image.yml up -d
```

The `voice-server-image` GitHub Actions workflow publishes `ghcr.io/yejnf/videomicrophonetogether-voice-server`. If you fork this repo, update `VOICE_SERVER_IMAGE` in `.env` to your own GHCR package path.
