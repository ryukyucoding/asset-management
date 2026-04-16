# Entity Relationship Diagram

```mermaid
erDiagram
    USER {
        string  id           PK  "cuid"
        string  name
        string  email        UK  "unique"
        string  passwordHash
        Role    role             "USER | ADMIN"
        string  department       "nullable"
        datetime createdAt
        datetime updatedAt
    }

    ASSET {
        string      id            PK  "cuid"
        string      name
        string      serialNo      UK  "unique"
        string      category          "e.g. 手機/電腦/平板"
        string      model             "nullable"
        string      spec              "nullable"
        string      supplier          "nullable"
        datetime    purchaseDate      "nullable"
        float       purchaseCost      "nullable"
        string      location
        string      assignedDept      "nullable"
        datetime    startDate         "nullable"
        datetime    warrantyExpiry    "nullable"
        AssetStatus status            "AVAILABLE | IN_REPAIR | RETIRED"
        string      holderId      FK  "nullable → USER.id"
        string      description       "nullable"
        datetime    createdAt
        datetime    updatedAt
    }

    APPLICATION {
        string            id               PK  "cuid"
        string            userId           FK  "→ USER.id"
        string            assetId          FK  "→ ASSET.id"
        ApplicationStatus status               "PENDING | IN_REPAIR | COMPLETED | REJECTED"
        string            faultDescription
        string[]          imageUrls            "repair photo URLs"
        datetime          repairDate           "nullable"
        string            repairContent        "nullable"
        string            repairSolution       "nullable"
        float             repairCost           "nullable"
        string            repairVendor         "nullable"
        datetime          createdAt
        datetime          updatedAt
    }

    APPROVAL {
        string         id            PK  "cuid"
        string         applicationId FK  "→ APPLICATION.id"
        string         approverId    FK  "→ USER.id"
        int            step              "approval step number"
        ApprovalAction action            "APPROVED | REJECTED"
        string         comment           "nullable"
        datetime       createdAt
    }

    NOTIFICATION {
        string   id        PK  "cuid"
        string   userId    FK  "→ USER.id"
        string   type
        string   message
        boolean  isRead        "default: false"
        datetime createdAt
    }

    AUDIT_LOG {
        string   id        PK  "cuid"
        string   actorId       "USER.id (not FK — soft ref)"
        string   action
        string   entity        "e.g. Asset | Application"
        string   entityId
        json     diff          "nullable — before/after snapshot"
        string   assetId   FK  "nullable → ASSET.id"
        datetime createdAt
    }

    %% ── Relationships ──────────────────────────────────────────
    USER         ||--o{ APPLICATION  : "submits"
    USER         ||--o{ APPROVAL     : "reviews"
    USER         ||--o{ NOTIFICATION : "receives"
    ASSET        ||--o{ APPLICATION  : "has repair requests"
    ASSET        ||--o{ AUDIT_LOG    : "tracked by"
    APPLICATION  ||--o{ APPROVAL     : "has approval steps"
```

## Enum Definitions

| Enum | Values |
|------|--------|
| `Role` | `USER`, `ADMIN` |
| `AssetStatus` | `AVAILABLE` (正常使用), `IN_REPAIR` (維修中), `RETIRED` (已報廢) |
| `ApplicationStatus` | `PENDING` (待審核), `IN_REPAIR` (審核通過/維修中), `COMPLETED` (維修完成), `REJECTED` (已拒絕) |
| `ApprovalAction` | `APPROVED`, `REJECTED` |

## Key Constraints

| Table | Constraint | Detail |
|-------|-----------|--------|
| `users` | UNIQUE | `email` |
| `assets` | UNIQUE | `serialNo` |
| `applications` | FK → `users` | `userId` (cascade on read) |
| `applications` | FK → `assets` | `assetId` |
| `approvals` | FK → `applications` | `applicationId` |
| `approvals` | FK → `users` | `approverId` |
| `notifications` | FK → `users` | `userId` |
| `audit_logs` | FK → `assets` | `assetId` (nullable) |
