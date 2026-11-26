export type NotificationPriority = 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAJA';

export type NotificationEntityType = 'PRODUCT' | 'BATCH' | 'CATEGORY' | 'BRAND';

export type Notification = {
  id: string;
  type: { code: string; name: string };
  tipoEntidad: NotificationEntityType | string;
  entidadId: string;
  titulo: string;
  mensaje: string;
  detalle: string | null;
  prioridad: NotificationPriority;
  fechaEmitida: string;
  fechaLectura: string | null;
  leida: boolean;
};

export type RelatedRecord = {
  tipoEntidad: NotificationEntityType | string;
  entidadId: string;
  route: string;
};
