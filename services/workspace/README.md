# Workspace Service

File management and storage microservice for the platform.

## Features
- User workspace management (create, list, delete)
- File system API (list, read, write, delete, move)
- Directory creation
- Storage quota enforcement
- Soft delete support
- JWT-less authentication via session cookies

## Endpoints
### Workspaces
- `POST /api/workspaces` - Create a new workspace
- `GET /api/workspaces` - List all user workspaces
- `GET /api/workspaces/:id` - Get workspace details
- `DELETE /api/workspaces/:id` - Delete workspace (soft delete)

### Files
- `GET /api/workspaces/:id/files` - List files in workspace
- `GET /api/workspaces/:id/files/*path` - Get file metadata
- `POST /api/workspaces/:id/files` - Create file/directory
- `POST /api/workspaces/:id/directories` - Create directory
- `DELETE /api/workspaces/:id/files/*path` - Delete file
- `POST /api/workspaces/:id/files/move` - Move/rename file

## Development
Run in dev mode:
```bash
pnpm dev
```

Build for production:
```bash
pnpm build
```

Run tests:
```bash
pnpm test
```