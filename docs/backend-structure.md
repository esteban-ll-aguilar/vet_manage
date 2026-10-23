# Estructura del backend

La fundación no crea módulos de negocio. El equipo añadirá cada módulo cuando
las maquetas y los requisitos estén definidos.

```text
vet-manage-api/src/
├── config/
├── common/
├── domain/
├── modules/
├── infrastructure/
├── health/
├── app.module.ts
└── main.ts
```

## Ejemplo de módulo futuro

Para crear `pets`, el equipo debe seguir este patrón:

```text
modules/pets/
├── repositories/
│   ├── pet.repository.ts
│   └── prisma-pet.repository.ts
├── dtos/
│   ├── create-pet.dto.ts
│   └── update-pet.dto.ts
├── services/
│   ├── create-pet.service.ts
│   ├── update-pet.service.ts
│   └── find-pets.service.ts
├── routes/
│   └── pets.controller.ts
└── pets.module.ts
```

La carpeta `src/modules/_template/` contiene esta estructura mediante archivos
`.gitkeep`. Para crear un módulo real, se copia `_template` y se reemplaza el
nombre por el dominio correspondiente.

No se agrega `use-cases/`. Los servicios son las operaciones de aplicación y
coordinan validación, repositorios y eventos cuando corresponda.

Las interfaces de repositorio pueden vivir en `repositories/`; sus
implementaciones que dependan de Prisma deben delegarse a
`infrastructure/database/prisma` o mantenerse separadas dentro del módulo sin
permitir que la lógica de negocio importe directamente el cliente Prisma.

## Regla de dependencias

```text
routes -> services -> repositories (interfaces)
                         ^
                         |
             infrastructure implementa interfaces
```

- `routes` conoce HTTP y DTOs.
- `services` conoce reglas de aplicación.
- `repositories` abstrae persistencia.
- `infrastructure` conoce Prisma, Redis y RabbitMQ.
- `common` contiene solo piezas compartidas y transversales.
- `domain` global queda reservado para conceptos compartidos; las entidades
  específicas pueden vivir dentro de su módulo.

## Desarrollo con Docker

Compose monta `vet-manage-api` dentro del contenedor y ejecuta
`npm run start:dev`. NestJS observa los archivos y reinicia la API cuando se
modifica TypeScript. `node_modules` y el cliente generado de Prisma usan
volúmenes separados para que el montaje del código no los oculte.
