# Vet Manage

Base del proyecto para la gestión veterinaria.

## Arquitectura

El backend es un monolito modular NestJS. La estructura técnica está en
`vet-manage-api/src` y cada módulo futuro debe organizarse con:

```text
<module>/
├── repositories/
├── dtos/
├── services/
├── routes/
└── <module>.module.ts
```

No se crean módulos de negocio ni carpetas `use-cases` en esta etapa.

## Levantar infraestructura y API

```bash
cp .env.example .env
make up
```

Los servicios `api` y `frontend` quedan en modo desarrollo, con el código
montado como volumen. Los cambios en `vet-manage-api/src` y
`vet-manage-frontend/src` se recargan automáticamente; no es necesario
reconstruir la imagen para cambios normales de TypeScript/React. Si cambian
`package.json`, ejecuta nuevamente `make up`.

Comandos equivalentes:

```bash
make up             # Docker Compose
make up-podman      # Podman Compose
make logs           # logs Docker
make logs-podman    # logs Podman
make down           # detener Docker
make down-podman    # detener Podman
make build          # build API y frontend
make test           # tests del backend
make lint           # lint API y frontend
```

Tailwind CSS está integrado con el plugin oficial de Vite y puede usarse
directamente en los componentes React:

```tsx
<button className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700">
  Guardar
</button>
```

Endpoints iniciales:

- API: http://localhost:3080/api/v1
- Frontend: http://localhost:5174
- Health: http://localhost:3080/api/v1/health
- Readiness: http://localhost:3080/api/v1/health/ready
- RabbitMQ Management: http://localhost:15673

Servicios locales:

| Servicio | Puerto |
|---|---:|
| API | 3080 |
| PostgreSQL | 55432 |
| Redis | 56379 |
| RabbitMQ AMQP | 55672 |
| RabbitMQ Management | 15673 |

La arquitectura completa está documentada en
`docs/architecture-vet-manage-2026-10-23.md`.
