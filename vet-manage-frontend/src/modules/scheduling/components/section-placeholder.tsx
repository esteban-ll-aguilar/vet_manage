import { SCHEDULING_SECTIONS, type SchedulingPath } from '../navigation';

// Contenido provisional de una sección; cada página lo reemplaza por su pantalla real.
export function SectionPlaceholder({ path }: { path: SchedulingPath }) {
  const section = SCHEDULING_SECTIONS.find((item) => item.path === path);
  if (!section) return null;

  return (
    <section className="empty-page">
      <span className="eyebrow">Agenda</span>
      <h2>{section.label}</h2>
      <p>{section.description}</p>
    </section>
  );
}
