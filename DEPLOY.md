# 暖暖陪伴 H5 公网部署

## 1. 服务器要求

- Linux 服务器，推荐 Ubuntu 22.04 / Debian 12 / CentOS 8+
- Node.js 18 或更高版本
- 一个域名，可选但推荐
- 需要开放服务器安全组 / 防火墙的 `80`、`443` 端口

## 2. 上传项目

把项目上传到服务器，例如：

```bash
scp -r Emotional root@your-server-ip:/var/www/nuannuan
```

进入项目目录：

```bash
cd /var/www/nuannuan
```

## 3. 配置环境变量

```bash
cp .env.example .env
nano .env
```

填写真实的 `DEEPSEEK_API_KEY`，不要把 `.env` 提交到 Git。

## 4. 本地检查

```bash
npm run check
npm start
```

浏览器访问：

```text
http://your-server-ip:4173
```

## 5. 使用 PM2 后台运行

```bash
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

查看状态：

```bash
pm2 status
pm2 logs nuannuan-emotional-h5
```

## 6. Nginx 反向代理

新建 Nginx 配置：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:4173;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用并重载：

```bash
nginx -t
systemctl reload nginx
```

## 7. HTTPS

如果使用 Certbot：

```bash
certbot --nginx -d your-domain.com
```

完成后访问：

```text
https://your-domain.com
```

## 8. 更新版本

上传新文件后执行：

```bash
cd /var/www/nuannuan
npm run check
pm2 restart nuannuan-emotional-h5
```
