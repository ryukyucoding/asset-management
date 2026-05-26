# Overall System Architecture

```mermaid
graph TB
    subgraph Client["Client Layer"]
        Browser["Browser\n(Vue 3 + Vite)"]
    end

    subgraph Gateway["API Gateway / Load Balancer"]
        LB["GCP Load Balancer\n(HTTPS)"]
    end

    subgraph AppLayer["Application Layer — GCP Cloud Run"]
        FE["Frontend Service\n(Vue 3 · Nginx)"]
        BE["Backend Service\n(Fastify · Node.js 22)"]
    end

    subgraph ServiceLayer["Service Layer"]
        Auth["Auth Service\nJWT · bcrypt"]
        AssetSvc["Asset Service\nCRUD · Status FSM"]
        AppSvc["Application Service\nApproval Workflow"]
        NotifSvc["Notification Service\nIn-App Alerts"]
    end

    subgraph Infra["Infrastructure Layer"]
        PrismaORM["Prisma ORM"]
        Repos["Repositories\nUser · Asset\nApplication · Notification"]
        RedisAdapters["Redis Adapters\nTokenStore · Cache · Queue"]
    end

    subgraph DataLayer["Data Layer — GCP"]
        PG["Cloud SQL\n(PostgreSQL 16)\nSoT"]
        Redis["Memorystore\n(Redis 7)\nSession · Cache · BullMQ"]
    end

    subgraph Observability["Observability"]
        Logs["Cloud Logging"]
        Monitor["Cloud Monitoring"]
    end

    Browser -->|HTTPS| LB
    LB --> FE
    FE -->|REST API\n/api/v1| BE
    BE --> Auth
    BE --> AssetSvc
    BE --> AppSvc
    BE --> NotifSvc
    Auth --> Repos
    AssetSvc --> Repos
    AppSvc --> Repos
    NotifSvc --> Repos
    Repos --> PrismaORM
    PrismaORM --> PG
    Auth --> RedisAdapters
    AssetSvc --> RedisAdapters
    AppSvc --> RedisAdapters
    BE --> RedisAdapters
    RedisAdapters --> Redis
    BE --> Logs
    BE --> Monitor
```

## Component Descriptions

| Component | Technology | Responsibility |
|-----------|-----------|----------------|
| Frontend Service | Vue 3, Vite, Element Plus, vue-i18n | UI, multi-language (zh-TW/en/ja/ko), role-based views |
| Backend Service | Fastify, TypeScript, Clean Architecture | REST API, business logic, JWT auth |
| Auth Service | bcrypt, JWT (RS256) | Login, registration, token refresh |
| Asset Service | Prisma | Asset CRUD, status transitions (AVAILABLE → IN_REPAIR → AVAILABLE/RETIRED) |
| Application Service | Prisma | Repair request lifecycle, approval workflow |
| Notification Service | Prisma | In-app notifications per application status change |
| Cloud SQL (PostgreSQL) | PostgreSQL 16 | Persistent relational data |
| Memorystore (Redis) | Redis 7 | Refresh session, token denylist, rate-limit, asset list cache, serial INCR, BullMQ (see [docs/redis.md](redis.md)) |
| Cloud Logging / Monitoring | GCP native | Structured logs, uptime alerts |

## Deployment Strategy

- **Frontend & Backend** deployed as separate Cloud Run services (independent scaling)
- **Zero-Downtime**: Cloud Run handles traffic splitting during new revision rollouts
- **Fault Tolerance**: Cloud Run auto-restarts unhealthy instances; Cloud SQL with read replica for HA
- **CI/CD**: GitHub Actions → build → test → push image to Artifact Registry → deploy to Cloud Run
