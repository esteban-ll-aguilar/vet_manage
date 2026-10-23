# Estructura del frontend

El frontend usa React/Vite y una organización por funcionalidad. La base se
mantiene liviana: no se agregan capas de dominio o casos de uso separados.

```text
src/
├── app/               composición, router y providers
├── config/            variables de entorno y configuración de API
├── common/            componentes, layouts, hooks y utilidades compartidas
├── infrastructure/    cliente HTTP y errores de transporte
├── modules/           funcionalidades del negocio
├── assets/
├── styles/
└── main.tsx
```

## Ejemplo de módulo

```text
modules/pets/
├── components/
├── pages/
├── hooks/
├── services/
├── types/
├── schemas/
└── routes.tsx
```

La carpeta `src/modules/_template/` contiene la estructura mediante archivos
`.gitkeep`. Para crear una funcionalidad, se copia `_template` y se cambia el
nombre por el dominio correspondiente.

El flujo recomendado es:

```text
Page -> Hook -> Module Service -> HTTP Client -> NestJS API
```
