# Traefik 3 — infra/docker, hosting

## Docker labels (HTTPS + LE)

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.web.rule=Host(`app.example.com`)"
  - "traefik.http.routers.web.entrypoints=websecure"
  - "traefik.http.routers.web.tls=true"
  - "traefik.http.routers.web.tls.certresolver=letsencrypt"
  - "traefik.http.services.web.loadbalancer.server.port=3000"
```

## Multi-domain + TLS options

```yaml
labels:
  - "traefik.http.routers.api.rule=Host(`api.example.com`) && PathPrefix(`/v1`)"
  - "traefik.http.routers.api.tls=true"
  - "traefik.http.routers.api.tls.certresolver=letsencrypt"
  - "traefik.http.routers.api.tls.options=modern-tls@file"
  - "traefik.http.routers.api.tls.domains[0].main=api.example.com"
  - "traefik.http.routers.api.tls.domains[0].sans=ws.example.com"
```

## TCP TLS passthrough (Postgres etc.)

```yaml
labels:
  - "traefik.tcp.routers.pg.tls=true"
  - "traefik.tcp.routers.pg.tls.passthrough=true"
  - "traefik.tcp.routers.pg.rule=HostSNI(`db.example.com`)"
  - "traefik.tcp.routers.pg.service=pg-svc"
```

## File provider middleware referans

```yaml
labels:
  - "traefik.http.routers.my.middlewares=add-foo-prefix@file"
```

## Multi-layer routers (parent + child)

```yaml
http:
  routers:
    api-parent:
      rule: "Host(`api.docker.localhost`) && PathPrefix(`/api`)"
      entryPoints: [websecure]
      middlewares: [auth-middleware]
    api-admin:
      rule: "HeadersRegexp(`X-Auth-User`, `admin`)"
      service: admin-backend@docker
      parentRefs: [api-parent@file]
```

## Migration: v2 → v3
- `tls.caOptional` v3'te kaldırıldı.

## Proje notları
- CloudMind hosting: `services/publish` her hosted app için Traefik label seti üretir; tenant ayrımı için `Host()` rule + per-tenant subdomain.
- Internal services arası iletişim için Traefik üstünden geçilmemeli (sadece public ingress).
- Rate limit / IP allow list için `RateLimit` ve `IPAllowList` middleware'lerini ekleyin.
