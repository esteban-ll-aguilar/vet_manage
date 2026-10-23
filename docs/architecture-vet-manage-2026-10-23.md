# Arquitectura de Vet Manage

**Versión:** 0.1-draft  
**Fecha:** 2026-10-23  
**Estado:** En revisión

## 1. Objetivo

Vet Manage será una plataforma web para la operación de una clínica veterinaria. La primera versión debe permitir administrar usuarios y permisos, propietarios, mascotas, pacientes, agenda, consultas e historial clínico. La arquitectura debe dejar espacio para inventario, facturación, notificaciones y reportes sin convertir el proyecto prematuramente en una plataforma de microservicios.

## 2. Decisión arquitectónica

### Patrón elegido: monolito modular

El backend será una sola aplicación NestJS desplegable, dividida en módulos de negocio con límites claros. Cada módulo tendrá sus propios servicios, rutas, repositorios y modelos de entrada/salida. No se crea una capa separada de `use-cases` en esta etapa.

```text
Frontend React/Vite
        |
        | REST /api/v1
        v
API NestJS (monolito modular)
  ├── Identity / Auth
  ├── Organizations / Clinics
  ├── Users / Roles
  ├── Clients / Owners
  ├── Pets / Patients
  ├── Appointments
  ├── Medical Records
  ├── Inventory       (fase posterior)
  ├── Billing         (fase posterior)
  └── Notifications   (fase posterior)
        |
        ├── PostgreSQL + Prisma: fuente de verdad
        ├── Redis: cache, rate limit, locks y sesiones efímeras
        └── RabbitMQ: trabajos y eventos asíncronos
```

### Por qué no microservicios todavía

- El backend actual es un starter sin dominio implementado.
- Todavía no hay suficiente carga, equipo ni límites de negocio validados para justificar despliegues independientes.
- Un monolito modular permite separar módulos posteriormente sin reescribir los casos de uso.
- PostgreSQL conserva consistencia transaccional para operaciones clínicas sensibles.

## 3. Estructura propuesta del backend

```text
src/
  app.module.ts
  main.ts
  config/
    env.validation.ts
    configuration.ts
  common/
    database/
    cache/
    messaging/
    http/
    errors/
    auth/
    pagination/
  modules/
    <future-module>/
      repositories/
      dtos/
      services/
      routes/
      <future-module>.module.ts
  health/
```

Cada módulo seguirá esta dirección de dependencias:

```text
presentation -> application -> domain
                    |
                    v
             infrastructure
```

El dominio no debe importar NestJS, Prisma, Redis ni RabbitMQ. Prisma se usará en `infrastructure` mediante repositorios y mapeadores. Los servicios contienen las operaciones de aplicación y quedan testeables sin levantar servicios externos.

## 4. Responsabilidades de infraestructura

### PostgreSQL

Fuente de verdad para usuarios, clínicas, propietarios, mascotas, citas e historias clínicas. Prisma será el único acceso persistente desde la aplicación. Las migraciones vivirán en `prisma/migrations` y se ejecutarán explícitamente durante el despliegue.

### Redis

Se usará únicamente para datos reconstruibles o temporales:

- cache de lecturas de baja volatilidad;
- rate limiting;
- locks de operaciones concurrentes, por ejemplo evitar doble reserva de una cita;
- sesiones o refresh tokens revocables, si se elige ese modelo.

Redis no será la fuente de verdad de ninguna entidad clínica.

### RabbitMQ

Se usará para trabajo asíncrono y eventos de integración, por ejemplo:

- `appointment.created`;
- `appointment.cancelled`;
- `medical-record.created`;
- envío de recordatorios;
- generación de reportes o tareas pesadas.

Las operaciones que requieren consistencia inmediata se harán en PostgreSQL. Para publicar eventos confiablemente se recomienda implementar un patrón outbox antes de habilitar procesos críticos.

## 5. Límites iniciales de dominio

### Identity

Autenticación, hash de contraseñas, refresh tokens, recuperación de acceso y autorización.

### Clinics

Clínicas, sucursales y configuración de la organización. Todas las entidades operativas deben quedar preparadas para `clinicId` o `organizationId`, aunque la primera entrega tenga una sola clínica.

### Clients

Propietarios o responsables de mascotas, contactos y consentimiento.

### Pets

Mascotas/pacientes, especie, raza, sexo, fecha de nacimiento, identificación y relación con su propietario.

### Appointments

Agenda, profesionales, disponibilidad, estados, cancelaciones y prevención de solapamientos.

### Medical Records

Consultas, signos, diagnósticos, tratamientos, vacunas, archivos y notas clínicas. Este módulo debe conservar auditoría y no sobrescribir silenciosamente información clínica histórica.

## 6. API

- Protocolo: REST JSON.
- Prefijo: `/api/v1`.
- Documentación: OpenAPI/Swagger.
- DTOs de entrada con validación estricta.
- Respuestas paginadas para colecciones.
- Error uniforme con `statusCode`, `code`, `message`, `details` y `requestId`.
- Autenticación: access token de corta duración y refresh token revocable.
- Autorización: RBAC por organización/clínica; roles iniciales sugeridos: `OWNER`, `ADMIN`, `VETERINARIAN`, `RECEPTIONIST`.

Ejemplos de recursos:

```text
POST   /api/v1/auth/login
GET    /api/v1/clients
POST   /api/v1/clients
GET    /api/v1/pets/:petId
POST   /api/v1/appointments
PATCH  /api/v1/appointments/:appointmentId/status
GET    /api/v1/pets/:petId/medical-records
```

## 7. Modelo de datos inicial

Entidades principales previstas para Prisma:

```text
Organization 1---N Clinic
Organization 1---N User
Client       1---N Pet
Pet          1---N Appointment
Clinic       1---N Appointment
User         1---N Appointment (veterinarian)
Pet          1---N MedicalRecord
Appointment  0---1 MedicalRecord
```

Reglas importantes:

- IDs UUID.
- `createdAt`, `updatedAt` en entidades mutables.
- Soft delete solo donde sea legal y útil; no borrar físicamente historia clínica.
- Índices en `organizationId`, `clinicId`, estados, fechas de agenda y llaves de búsqueda.
- Restricciones únicas para email dentro de la organización y para evitar solapamientos de agenda.
- Auditoría para cambios de permisos y registros clínicos.

El schema definitivo debe cerrarse con los casos de uso y las maquetas, no inventarse únicamente desde tablas.

## 8. Puertos de desarrollo propuestos

Los puertos publicados al host no usarán los valores habituales:

| Servicio | Puerto del host | Puerto del contenedor | Uso |
|---|---:|---:|---|
| Frontend Vite | `5174` | `5174` | Aplicación web |
| API NestJS | `3080` | `3080` | REST/OpenAPI |
| PostgreSQL | `55432` | `55432` | Persistencia |
| Redis | `56379` | `56379` | Cache y locks |
| RabbitMQ AMQP | `55672` | `55672` | Mensajería |
| RabbitMQ Management | `15673` | `15673` | Panel administrativo |

La API debe conectarse a `postgres`, `redis` y `rabbitmq` por nombre de servicio dentro de la red Docker, no por `localhost`. Los valores de los puertos deben vivir en `.env.example`, nunca hardcodeados en Prisma o en los módulos.

## 9. Requisitos no funcionales

| Área | Decisión |
|---|---|
| Seguridad | Validación global, headers seguros, secretos por entorno, contraseñas con Argon2 o bcrypt, RBAC y auditoría. |
| Consistencia | Transacciones Prisma para operaciones clínicas y de agenda; outbox para eventos. |
| Rendimiento | Índices PostgreSQL, paginación, cache selectivo y consumidores asíncronos. |
| Disponibilidad | Health checks para API, PostgreSQL, Redis y RabbitMQ; reintentos limitados en consumidores. |
| Observabilidad | Logs JSON con `requestId`, endpoint de health y métricas de errores/latencia. |
| Mantenibilidad | Módulos por dominio, DTOs explícitos, repositorios y pruebas unitarias/e2e. |
| Escalabilidad | API stateless; múltiples réplicas futuras; consumidores RabbitMQ separados cuando haya carga real. |
| Privacidad | Minimización de datos, control por organización, no exponer datos clínicos en logs. |

## 10. Orden de implementación

1. Configuración centralizada y validación de entorno.
2. Docker Compose de desarrollo: PostgreSQL, Redis, RabbitMQ, API y frontend.
3. Prisma Client, migraciones, módulo de base de datos y health checks.
4. Identity, organización/clínica y RBAC.
5. Clients y Pets.
6. Appointments con transacciones, locks y eventos.
7. Medical Records con auditoría.
8. Notificaciones, inventario y facturación según las maquetas y prioridades.

## 11. Decisiones pendientes antes de implementar

- ¿El sistema será multi-clínica/multi-tenant desde la primera versión o solo se preparará el campo?
- ¿Qué roles y flujos muestran exactamente las maquetas?
- ¿La agenda necesita múltiples veterinarios, salas y sucursales?
- ¿Los archivos clínicos se guardarán inicialmente en disco/S3 compatible o quedan fuera del MVP?
- ¿Se requiere facturación electrónica desde el inicio?

Estas respuestas cambian el modelo Prisma, especialmente `Organization`, `Clinic`, permisos, agenda e historia clínica.
