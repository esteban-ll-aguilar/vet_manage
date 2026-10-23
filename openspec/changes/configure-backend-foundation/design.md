# Design: Fundación del backend

## Architecture

```text
src/
├── config/          configuración y validación
├── common/          errores, guards, decorators y tipos compartidos
├── domain/          conceptos verdaderamente compartidos
├── modules/         módulos de negocio futuros
└── infrastructure/  Prisma, Redis y RabbitMQ
```

Cada módulo futuro seguirá:

```text
<module>/
├── repositories/
├── dtos/
├── services/
├── routes/
└── <module>.module.ts
```

No se crea `use-cases/`. Los servicios representan las operaciones de aplicación hasta que exista una razón concreta para separar otra capa.

## Runtime

```text
Host -> API :3080
Host -> PostgreSQL :55432
Host -> Redis :56379
Host -> RabbitMQ AMQP :55672
Host -> RabbitMQ Management :15673
```

Dentro de Docker, la API se conecta a `postgres`, `redis` y `rabbitmq` usando los puertos internos personalizados y nombres DNS de Compose, nunca `localhost`.

## Environment

- `PORT=3080`
- `DATABASE_URL=postgresql://...@postgres:55432/vet_manage?schema=public`
- `REDIS_URL=redis://redis:56379`
- `RABBITMQ_URL=amqp://...@rabbitmq:55672`

Los secretos solo se mantienen en `.env`; `.env.example` contiene valores de muestra sin credenciales reales.

## Components

- `ConfigModule`: carga y valida entorno al iniciar.
- `PrismaModule`: expone un único `PrismaService` y desconecta limpiamente.
- `HealthModule`: verifica que la aplicación esté viva y que las dependencias puedan responder.
- `RedisModule` y `RabbitmqModule`: adaptadores mínimos preparados para futuras funcionalidades, sin lógica de negocio.

## Verification

```bash
docker compose config
npm run build
npm test -- --run
npm run lint
```
