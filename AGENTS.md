# AGENTS.md

## Overview

This project is a monolithic NestJS backend with a React/Vite frontend, using Docker Compose for local development.

## Developer Commands

- Start services: `make up`
- Stop services: `make down`
- View logs: `make logs`
- Run tests: `make test`
- Run linter: `make lint`
- Build API and frontend: `make build`

## Architecture

- **Backend**: NestJS monolith modular, structured into modules under `vet-manage-api/src/modules/`.
- **Frontend**: React/Vite with Tailwind CSS.
- **Database**: PostgreSQL via Prisma ORM.
- **Caching**: Redis.
- **Messaging**: RabbitMQ.

## Entry Points

- API: http://localhost:3080/api/v1
- Frontend: http://localhost:5174
- Health check: http://localhost:3080/api/v1/health
- RabbitMQ Management: http://localhost:15673

## Environment

- Copy `.env.example` to `.env` before running.
- Services connect via Docker service names, not localhost.
- Default ports are remapped from standard ones (e.g., PostgreSQL on 55432).

## Testing

- Unit tests: `npm test` in `vet-manage-api/`
- End-to-end tests: `npm run test:e2e` in `vet-manage-api/`

## Key Directories

- `vet-manage-api/`: Backend NestJS application
- `vet-manage-frontend/`: Frontend React/Vite application
- `docs/`: Documentation including architecture overview
- `openspec/`: OpenSpec change management artifacts
