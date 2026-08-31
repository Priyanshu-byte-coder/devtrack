# Docker Development Setup

DevTrack includes Docker support for local development, allowing contributors to get started quickly without manually installing dependencies or configuring environments.

## Prerequisites

- Docker Desktop (Windows/macOS) or Docker Engine (Linux)
- Docker Compose v2+

Verify installation:

```bash
docker --version
docker compose version
```

## Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Fill in the required values as described in [DEVELOPMENT.md](../DEVELOPMENT.md).

## Start the Application

Build and start the development container:

```bash
docker compose up --build
```

The application will be available at:

```text
http://localhost:3000
```

## Stop the Application

```bash
docker compose down
```

## Hot Reload Support

The project source code is mounted into the container using Docker volumes.

Any changes made to files on your host machine are automatically reflected inside the container, enabling Next.js hot reload during development without rebuilding the image.

## Rebuild After Dependency Changes

If you modify `package.json` or install new dependencies:

```bash
docker compose down
docker compose up --build
```

## Troubleshooting

Remove containers and rebuild from scratch:

```bash
docker compose down -v
docker compose up --build
```

View container logs:

```bash
docker compose logs -f
```
