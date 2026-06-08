# CentOS Docker Compose 部署

这份文档对应仓库里的语音服务 `source/voice-server`，目标是保持和你之前 `memos` 一样的部署习惯：

- 应用和 Nginx 都由 `docker compose` 启动
- Nginx 配置文件直接放在宿主机目录
- 不需要进入 Nginx 容器手工改配置

## 目录约定

以下示例默认把项目放在 `/opt/VideoMicroPhoneTogether`：

```text
/opt/VideoMicroPhoneTogether
├── .env
├── docker-compose.centos.yml
└── deploy
    ├── certs
    │   ├── fullchain.pem
    │   └── privkey.pem
    └── nginx
        └── voice.compose.conf
```

## 1. 安装 Docker 和 Compose

按 Docker 官方文档，2026-06-08 这天仍然推荐在受支持的 CentOS 上通过官方仓库安装 `docker-ce` 和 `docker-compose-plugin`。官方当前列出的受支持系统是 `CentOS Stream 9` 和 `CentOS Stream 10`。

```bash
sudo dnf -y install dnf-plugins-core
sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker run hello-world
docker compose version
```

如果你希望当前登录用户直接执行 `docker`，再执行：

```bash
sudo usermod -aG docker $USER
newgrp docker
```

## 2. 拉取项目

```bash
sudo mkdir -p /opt
cd /opt
sudo git clone <你的仓库地址> VideoMicroPhoneTogether
sudo chown -R $USER:$USER /opt/VideoMicroPhoneTogether
cd /opt/VideoMicroPhoneTogether
```

如果你不是通过 Git 部署，也可以直接把当前仓库内容上传到这个目录。

## 3. 准备环境变量

复制模板：

```bash
cp .env.example .env
```

至少要改这些值：

- `PUBLIC_IP`：VPS 公网 IPv4
- `DOMAIN`：语音服务域名，比如 `voice.example.com`
- `ROOM_SECRET`：务必换成足够长的随机字符串
- `CORS_ORIGIN`：如果要允许所有站点接入，保留 `*`；如果只服务自有站点，改成你的站点 Origin

一个可用示例：

```dotenv
PUBLIC_IP=203.0.113.10
DOMAIN=voice.example.com
PORT=3000
RTC_MIN_PORT=40000
RTC_MAX_PORT=40100
ROOM_SECRET=replace-with-a-long-random-secret
ALLOW_OPEN_ROOMS=false
CORS_ORIGIN=*
VOICE_SERVER_IMAGE=ghcr.io/yejnf/videomicrophonetogether-voice-server:latest
```

## 4. 准备 HTTPS 证书

语音服务需要走 `HTTPS/WSS`，所以要先把证书文件放到宿主机目录，再由 Nginx 容器挂载进去。

```bash
mkdir -p deploy/certs
```

把证书放成下面这两个文件名：

```text
deploy/certs/fullchain.pem
deploy/certs/privkey.pem
```

如果你本机已经有 Let’s Encrypt 证书，也可以直接复制：

```bash
cp /etc/letsencrypt/live/voice.example.com/fullchain.pem deploy/certs/fullchain.pem
cp /etc/letsencrypt/live/voice.example.com/privkey.pem deploy/certs/privkey.pem
```

## 5. 准备 Nginx 配置

仓库已经提供了容器化配置模板：

`deploy/nginx/voice.compose.conf`

你只需要把里面的 `voice.example.com` 改成你的真实域名。这个方式和你之前的 `memos.conf` 一样，都是直接改宿主机上的配置文件，不需要进入 Nginx 容器。

这份配置的关键点是：

- `proxy_pass http://voice-server:3000;` 直接走 Compose 内部服务名
- `location /socket.io/` 开启 WebSocket 升级
- `80` 自动跳转到 `443`
- UDP 媒体端口不经过 Nginx，而是直接映射给 `voice-server`

## 6. 启动服务

直接在项目根目录执行：

```bash
docker compose -f docker-compose.centos.yml up -d
```

查看状态：

```bash
docker compose -f docker-compose.centos.yml ps
docker compose -f docker-compose.centos.yml logs -f voice-server
docker compose -f docker-compose.centos.yml logs -f nginx
```

## 7. 开放防火墙

至少放行这些端口：

- `80/tcp`
- `443/tcp`
- `40000-40100/udp`

如果你使用 `firewalld`：

```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --permanent --add-port=40000-40100/udp
sudo firewall-cmd --reload
```

## 8. 验证

先验证 HTTP 健康检查是否能通过反代访问：

```bash
curl -I http://voice.example.com
curl https://voice.example.com/healthz
```

正常情况下 `/healthz` 会返回：

```json
{"ok":true}
```

然后在接入 VideoTogether 的页面上设置：

```html
<script>
  window.VideoTogetherVoiceServer = "https://voice.example.com";
  window.VideoTogetherVoiceRoomSecret = "和 .env 里的 ROOM_SECRET 保持一致";
</script>
```

## 9. 更新方式

以后更新可以直接重复这一套：

```bash
cd /opt/VideoMicroPhoneTogether
git pull
docker compose -f docker-compose.centos.yml pull
docker compose -f docker-compose.centos.yml up -d
```

如果你修改了 `deploy/nginx/voice.compose.conf` 或证书文件，也只需要重新拉起：

```bash
docker compose -f docker-compose.centos.yml up -d
```

## 和 memos 方案的对应关系

你的 `memos` 是：

- 宿主机目录放 `docker-compose.yml`
- 宿主机目录放 `nginx/memos.conf`
- `docker compose up -d` 后由 Nginx 容器读取挂载配置

当前项目在这个仓库里对应为：

- `docker-compose.centos.yml`
- `deploy/nginx/voice.compose.conf`
- `deploy/certs/fullchain.pem`
- `deploy/certs/privkey.pem`

启动命令同样是：

```bash
docker compose -f docker-compose.centos.yml up -d
```

## 补充说明

- 如果你的服务器内存比较小，优先使用这个文档里的预构建镜像方案，不要在服务器上本地编译 `mediasoup`
- `voice-server` 只处理信令和音频，不转发视频画面
- 麦克风语音是 WebRTC UDP 流量，所以 `RTC_MIN_PORT` 到 `RTC_MAX_PORT` 的 UDP 端口一定要放通
