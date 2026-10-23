# Proposal: Configurar la fundación del backend

## Why

El backend actual es el starter de NestJS y Prisma no tiene todavía una base operativa para desarrollo local. Antes de que el equipo implemente dominios de negocio se necesita una arquitectura de carpetas, configuración centralizada, persistencia y servicios de infraestructura reproducibles.

## What changes

- Crear la estructura base `config`, `common`, `domain`, `modules` e `infrastructure`.
- Configurar validación de entorno y arranque de NestJS en un puerto no predeterminado.
- Configurar Prisma 7 para PostgreSQL y un módulo de acceso a base de datos.
- Crear Docker Compose para API, PostgreSQL, Redis y RabbitMQ.
- Añadir health checks y documentación de arranque.
- Documentar un módulo de ejemplo sin crear módulos de negocio reales.

## In scope

- Fundación técnica y estructura.
- Prisma sin entidades de negocio, con una migración inicial válida si es necesaria.
- PostgreSQL, Redis y RabbitMQ para desarrollo local.
- Configuración por `.env` y `.env.example`.

## Out of scope

- Auth, clientes, mascotas, citas o historias clínicas funcionales.
- Entidades y tablas de negocio.
- Endpoints de negocio.
- Frontend funcional.
- Despliegue productivo.

## Success criteria

- `docker compose config` valida el Compose.
- Los servicios de infraestructura arrancan con puertos personalizados.
- La API arranca y expone un endpoint de health.
- Prisma puede validar/generar cliente contra PostgreSQL.
- La estructura queda documentada y no contiene `use-cases/`.
- Las pruebas, build y lint existentes pasan.
