# Tasks

## Layer 0 — Modelo Prisma

- [x] 0.1 Añadir enums y modelos de identidad/RBAC con UUID y relaciones.
- [x] 0.2 Generar y validar Prisma Client.
- [x] 0.3 Crear migración inicial del modelo.

## Layer 1 — Contrato de errores

- [x] 1.1 Crear `ApiException` y envelope de respuesta.
- [x] 1.2 Registrar filtro global de excepciones en NestJS.

## Layer 2 — Catálogos y sincronización

- [x] 2.1 Crear catálogo declarativo de permisos.
- [x] 2.2 Crear catálogo declarativo de roles y grants.
- [x] 2.3 Implementar sincronización idempotente con reactivación y desactivación lógica.
- [x] 2.4 Ejecutar sincronización durante el arranque.

## Layer 3 — Verificación

- [ ] 3.1 Añadir pruebas de sincronización y excepciones.
- [x] 3.2 Ejecutar build, lint, tests, Prisma validate y migración.
- [x] 3.3 Documentar cómo agregar y retirar permisos/roles.

## Parallelization plan

- Layer 0 debe completarse antes de Layer 2.
- Layer 1 puede implementarse en paralelo con Layer 0.
- Layer 2 depende del schema Prisma.
- Layer 3 se ejecuta después de integrar todas las capas.
