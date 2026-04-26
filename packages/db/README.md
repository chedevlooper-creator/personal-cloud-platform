# @pcp/db

Database package for Personal Cloud Platform using Drizzle ORM and PostgreSQL.

## Features
- **Drizzle ORM** with PostgreSQL driver
- **Migration runner** via `drizzle-kit`
- **Connection pool** configured out-of-the-box
- **Type-safe schema exports**
- **Zod validation** for database environment variables
- **Health check** function built-in

## Usage

### Environment Variables
Create a `.env` file or export the following variables:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
DB_MAX_CONNECTIONS=10
```

### Scripts
- `pnpm run generate`: Generate SQL migrations based on schema changes
- `pnpm run migrate`: Run pending migrations against the database
- `pnpm run push`: Push schema changes directly to the database (dev only)
- `pnpm run studio`: Open Drizzle Studio to browse your data
- `pnpm run seed`: Run the seed script to populate initial data

### Importing in other packages
```typescript
import { db, checkDbHealth } from '@pcp/db/src/client';
import { users } from '@pcp/db/src/schema';

// Query data
const allUsers = await db.query.users.findMany();

// Check health
const isHealthy = await checkDbHealth();
```
