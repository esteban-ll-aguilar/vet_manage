# Tasks

## Layer 0 — Esqueleto y configuración

- [x] 0.1 Crear la estructura base de carpetas sin módulos de negocio.
- [x] 0.2 Añadir configuración centralizada y validación de variables de entorno.
- [x] 0.3 Actualizar el bootstrap de NestJS con puerto, prefijo API y validaciones globales.

## Layer 1 — Persistencia y dependencias

- [x] 1.1 Configurar Prisma 7 y `PrismaService` sin modelos de negocio.
- [x] 1.2 Añadir adaptadores mínimos para Redis y RabbitMQ.
- [x] 1.3 Añadir health check de aplicación y dependencias.

## Layer 2 — Contenedores

- [x] 2.1 Crear Dockerfile de desarrollo/producción para la API.
- [x] 2.2 Crear Docker Compose con API, PostgreSQL, Redis y RabbitMQ.
- [x] 2.3 Cambiar los puertos publicados e internos a los valores documentados.

## Layer 3 — Documentación y validación

- [x] 3.1 Documentar el árbol de arquitectura y el ejemplo de módulo.
- [x] 3.2 Actualizar README y `.env.example` con comandos de arranque.
- [ ] 3.3 Ejecutar Compose config, build, lint y pruebas. Compose config, build, lint y pruebas pasan; falta ejecutar contenedores porque el daemon Docker local no está disponible.

## Parallelization plan

- Layer 0 puede hacerse antes que todo.
- Layer 1 depende de Layer 0, pero Prisma, Redis/RabbitMQ y health checks pueden implementarse en paralelo si no modifican los mismos archivos.
- Layer 2 depende de los nombres finales de configuración.
- Layer 3 se completa después de validar el runtime.
