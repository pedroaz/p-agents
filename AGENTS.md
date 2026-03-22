# Application Structure

- `server/` - Python Flask API (port 5556)
- `ui/` - Next.js frontend (port 5555)

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
