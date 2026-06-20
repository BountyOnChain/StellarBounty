# Deployment

Run the NestJS backend behind a TLS-terminating reverse proxy such as Caddy,
nginx, or Traefik. Do not expose the backend's plain HTTP port directly to the
public internet.

## Backend Environment

Set these values for production deployments:

```env
NODE_ENV=production
TRUST_PROXY=true
PORT=4000
```

`NODE_ENV=production` enables a one-year `Strict-Transport-Security` header
with subdomain coverage. `TRUST_PROXY=true` tells Express to trust the first
proxy hop so logs and request handling can use forwarded protocol and client IP
headers correctly.

## Caddy Example

```caddyfile
api.example.com {
  reverse_proxy 127.0.0.1:4000
}
```

## nginx Example

```nginx
server {
  listen 443 ssl http2;
  server_name api.example.com;

  ssl_certificate /etc/letsencrypt/live/api.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}

server {
  listen 80;
  server_name api.example.com;
  return 301 https://$host$request_uri;
}
```
