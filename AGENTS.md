# Application Structure

- `server/` - Python Flask API (port 5556)
- `ui/` - Next.js frontend (port 5555)

# OpenCode Integration

The Flask server communicates with OpenCode server via HTTP API (port 5557) by default. Use CLI mode only when API is unavailable.

## OpenCode Endpoints (Internal)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET` | `/opencode/health` | Check opencode server health |
| `GET` | `/opencode/agents` | List agents from opencode server |
| `GET` | `/opencode/sessions` | List sessions |
| `POST` | `/opencode/send-message` | Send prompt to opencode server |
| `POST` | `/opencode/sessions/<id>/abort` | Abort a session |

## Task Execution

Task execution uses the opencode HTTP API by default (not CLI). To force CLI mode: `POST /tasks/<id>/execute?api=false`.

# Package Manager

This project uses **pnpm** as the package manager. Do NOT use npm or yarn.

## Common Commands

```bash
# Install dependencies
cd ui && pnpm install

# Run development server
cd ui && pnpm run dev

# Build for production
cd ui && pnpm run build

# Run linting
cd ui && pnpm run lint
```

# Rules

- MUST NEVER commit secrets or API keys to the repository
- MUST NEVER skip linting or typechecking before committing
- MUST NEVER push directly to main/master without code review
- MUST always use pixel components from the pixel registry, never base shadcn components directly
- MUST use pnpm for all package management in the ui/ directory
