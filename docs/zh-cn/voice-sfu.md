# 服务器中继加密语音聊天

VideoTogether 的视频仍由原视频网站直接传输，现有 Go 服务仍只处理同步播放控制消息。新增的 `source/voice-server` 是独立的 Node.js + Socket.IO + mediasoup 音频 SFU：浏览器只发布麦克风音轨，SFU 只创建 `audio/opus` producer/consumer，不接收或转发视频画面。浏览器到 mediasoup WebRTC Transport 的媒体使用标准 DTLS/SRTP 加密。

## 架构与事件

语音服务按与 VideoTogether 房间 UUID 组合后的 `roomId` 隔离房间。客户端加入后获取 Router RTP capabilities，并分别创建 send/recv WebRTC Transport；麦克风通过 `produce-audio` 发布，其他成员通过 `consume-audio` 与 `resume-consumer` 订阅。服务支持以下 Socket.IO 事件：

- 客户端：`join-room`、`get-rtp-capabilities`、`create-webrtc-transport`、`connect-transport`、`produce-audio`、`consume-audio`、`resume-consumer`、`set-muted`、`leave-room`。
- 服务端：`room-joined`、`new-audio-producer`、`producer-closed`、`peer-muted`、`peer-left`、`error`。

连接断开、显式离开或刷新页面时，服务端会关闭该成员的 consumer、producer 和 transport；空房间的 mediasoup Router 也会关闭。新加入成员会收到当前 producer 列表，新 producer 会实时广播给房间内其他成员。客户端以 producerId 去重，避免重复订阅。

## 部署

1. 复制并修改环境变量：

   ```bash
   cp .env.example .env
   ```

2. `PUBLIC_IP` 必须是 VPS 的公网 IPv4。`DOMAIN` 是 HTTPS/WSS 域名。`ROOM_SECRET` 可选；设置后，页面需要在 VideoTogether 脚本运行前设置相同的 `window.VideoTogetherVoiceRoomSecret`。
3. 启动服务：

   ```bash
   docker compose up -d --build
   ```

4. 将 `deploy/nginx/voice.conf` 安装到 Nginx 并替换域名及证书路径。
5. 防火墙开放 TCP 443、可选的 TCP 3000，以及 UDP 40000-40100。Nginx 只代理 HTTPS/WSS 信令和依赖脚本；UDP 媒体必须直接到达容器映射端口。
6. 在 VideoTogether 脚本运行前设置语音服务地址，例如：

   ```html
   <script>window.VideoTogetherVoiceServer = "https://voice.example.com";</script>
   ```

`mediasoup` 的 WebRtcTransport 监听容器内 `0.0.0.0`，并使用 `PUBLIC_IP`（也可用能解析到公网 IP 的 `DOMAIN`）作为 `announcedIp`。不要把私网 IP 填入 `PUBLIC_IP`。

## 容量与运维

默认配置仅转发 Opus 音频，适合 1 核 1 GB VPS 上的 3-5 人小房间。实际容量取决于码率、房间数量和网络质量。建议监控 CPU、内存、UDP 丢包与出口流量，并通过 `/healthz` 做存活检查。视频流量不应出现在此服务的网络监控中。

## 验收步骤

1. 主播与观众进入同一 VideoTogether 房间，验证播放、暂停、seek 与房主控制仍然同步。
2. 双方点击“加入语音”，授予麦克风权限，确认语音成员列表与静音状态更新并能互相听见。
3. 查看 voice-server 流量，确认只有信令和 Opus 音频，没有视频大流量。
4. 刷新页面或短暂断网后重新加入语音，确认旧 producer/transport 已清理且不会重复播放。
