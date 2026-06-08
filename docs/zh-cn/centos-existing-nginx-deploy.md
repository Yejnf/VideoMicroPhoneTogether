# CentOS 部署：复用已有 Nginx 容器

如果你的服务器上已经有一个正在跑的 `nginx` 容器，并且它已经占用了 `80/443`，那就不要再为这个项目再起一个新的 Nginx 容器。

你现在遇到的报错本质上有两个冲突：

- 你手工写成了 `container_name: nginx`，和现有容器重名
- 即使改掉容器名，新的 Nginx 也还会继续和现有 Nginx 抢 `80/443`

所以这种场景的正确做法是：

- 当前项目只启动 `voice-server`
- 复用已经存在的 `nginx` 容器做反向代理
- 让 `nginx` 容器和 `voice-server` 容器加入同一个 Docker 网络

## 需要用到的文件

- `docker-compose.centos.existing-nginx.yml`
- `deploy/nginx/voice.existing-nginx.conf`

## 1. 创建共享网络

先创建一个给反向代理共用的 Docker 网络：

```bash
docker network create shared-nginx
```

如果提示已经存在，可以忽略。

## 2. 把现有 nginx 容器接入这个网络

你的现有容器名就是 `nginx`，执行：

```bash
docker network connect shared-nginx nginx
```

如果提示 `already exists` 或 `is already connected`，也可以忽略。

## 3. 启动当前项目的 voice-server

在项目目录里执行：

```bash
docker compose -f docker-compose.centos.existing-nginx.yml up -d
```

这个文件不会再启动第二个 Nginx，只会启动：

- `videomicrophonetogether-voice-server`

并且它会自动加入 `shared-nginx` 网络。

## 4. 给现有 nginx 增加一个站点配置

把下面这个模板放到“你现有 nginx 容器所挂载的 conf.d 宿主机目录”中：

- `deploy/nginx/voice.existing-nginx.conf`

把里面的 `voice.example.com` 改成你的真实域名。

这个配置里最关键的一行是：

```nginx
proxy_pass http://videomicrophonetogether-voice-server:3000;
```

因为现有 nginx 和当前项目的 `voice-server` 已经在同一个 Docker 网络里了，所以可以直接按容器名转发。

## 5. 重载现有 nginx

不需要进入容器交互，只需要执行：

```bash
docker exec nginx nginx -s reload
```

如果你更习惯重启，也可以：

```bash
docker restart nginx
```

## 6. 环境变量和证书

`.env` 还是按原来的方式准备：

```bash
cp .env.example .env
```

至少要填：

- `PUBLIC_IP`
- `DOMAIN`
- `ROOM_SECRET`

证书还是由你现有的 nginx 容器负责读取。也就是说：

- 如果你现有 nginx 已经挂载了证书目录，就继续沿用它
- `voice.existing-nginx.conf` 里的证书路径要和你现有 nginx 容器里的实际路径保持一致

## 7. 验证

查看服务状态：

```bash
docker compose -f docker-compose.centos.existing-nginx.yml ps
docker logs videomicrophonetogether-voice-server --tail 100
docker logs nginx --tail 100
```

## 最适合你当前机器的做法

按你现在的情况，不要再执行这个：

```bash
docker compose -f docker-compose.centos.yml up -d
```

而是改成：

```bash
docker network create shared-nginx
docker network connect shared-nginx nginx
docker compose -f docker-compose.centos.existing-nginx.yml up -d
docker exec nginx nginx -s reload
```

前提是你已经把站点配置文件放进现有 nginx 容器挂载的 `conf.d` 对应宿主机目录里。
