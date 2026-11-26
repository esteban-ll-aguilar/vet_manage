export type CatalogTab = 'species' | 'breeds' | 'procedures';

// Cada pestaña se muestra solo si el usuario tiene su permiso de consulta.
export const CATALOG_TABS: readonly { id: CatalogTab; label: string; permission: string }[] = [
  { id: 'species', label: 'Especies', permission: 'species:read' },
  { id: 'breeds', label: 'Razas', permission: 'breeds:read' },
  { id: 'procedures', label: 'Tipos de procedimiento', permission: 'procedure-types:read' },
];

// Basta con uno de estos permisos para entrar a Catálogos.
export const CATALOG_PERMISSIONS = CATALOG_TABS.map((tab) => tab.permission);
