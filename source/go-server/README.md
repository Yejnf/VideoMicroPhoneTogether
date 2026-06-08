# VideoTogether Go Server

## SSL证书配置 (Certbot)

### 1. 安装 Certbot

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install certbot

# CentOS/RHEL
sudo yum install certbot
# 或 dnf install certbot

# macOS
brew install certbot
```

### 2. 申请 certonly 证书

使用 `certonly` 模式申请证书，不会自动配置web服务器：

```bash
# 使用 standalone 模式 (需要停止占用80端口的服务)
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# 或使用 webroot 模式 (如果有其他web服务器运行)
sudo certbot certonly --webroot -w /var/www/html -d yourdomain.com -d www.yourdomain.com

# 或使用 DNS 验证 (推荐用于服务器)
sudo certbot certonly --manual --preferred-challenges dns -d yourdomain.com
```

### 3. 证书文件位置

申请成功后，证书文件会保存在：
```
/etc/letsencrypt/live/yourdomain.com/
├── cert.pem          # 证书文件
├── chain.pem         # 中间证书
├── fullchain.pem     # 完整证书链 (推荐使用)
└── privkey.pem       # 私钥文件
```

### 4. 配置 Go Server

复制并修改运行配置：

```bash
cp config.example.json config.json
```

默认读取当前目录下的 `config.json`。如果配置文件放在其他路径，可以使用环境变量：

```bash
export CONFIG_FILE="/opt/videotogether/config.json"
```

如果缺少配置文件，服务会使用内置默认值启动并打印告警，方便临时部署；正式环境仍建议提供 `config.json`，尤其是 Kraken endpoint、屏蔽域名、赞助图和 Reecho 配置。

修改 `main.go` 中的证书域名默认值：

```go
if certFile == "" {
    certFile = "/etc/letsencrypt/live/yourdomain.com/fullchain.pem"
}
if keyFile == "" {
    keyFile = "/etc/letsencrypt/live/yourdomain.com/privkey.pem"
}
```

或使用环境变量：

```bash
export CERT_FILE="/etc/letsencrypt/live/yourdomain.com/fullchain.pem"
export KEY_FILE="/etc/letsencrypt/live/yourdomain.com/privkey.pem"
./server prod
```

跨域响应默认允许 `*`，这是为了兼容用户脚本从不同视频网站访问同步服务。如需收紧来源，可以设置：

```bash
export CORS_ORIGIN="https://your-site.example"
```

### 5. 自动续期

Certbot 证书有效期90天，`certonly` 模式的证书**会自动续期**：

```bash
# 查看自动续期状态
sudo systemctl status certbot.timer

# 启用自动续期 (通常默认已启用)
sudo systemctl enable certbot.timer

# 手动测试续期 (不会实际续期)
sudo certbot renew --dry-run
```

注意：系统会自动续期证书文件，Go服务器每24小时会自动重载新证书，无需手动重启。

### 6. 启动服务

```bash
# 编译
go build -o server

# 生产环境启动 (使用SSL)
sudo ./server prod

# 开发环境启动 (无SSL)
./server debug
```

### 7. 防火墙配置

确保开放必要端口：

```bash
# 证书验证需要80端口
sudo ufw allow 80

# HTTPS服务需要443/5000端口
sudo ufw allow 443
sudo ufw allow 5000
```

### 故障排除

1. **权限问题**：确保程序有读取证书文件的权限
2. **端口占用**：standalone模式需要80端口空闲
3. **DNS解析**：确保域名正确解析到服务器IP
4. **证书过期**：程序会每24小时自动重载证书
