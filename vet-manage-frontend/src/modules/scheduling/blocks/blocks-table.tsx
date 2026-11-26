import { useState } from 'react';
import type { ScheduleBlock } from './types';

type BlocksTableProps = {
  blocks: ScheduleBlock[];
  // Sin permiso para eliminar no se muestra la columna de acciones.
  canRemove: boolean;
  onRemove: (block: ScheduleBlock) => Promise<void>;
};

const formatDate = (iso: string) => {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
};

export function BlocksTable({ blocks, canRemove, onRemove }: BlocksTableProps) {
  // Bloqueo que espera confirmación y bloqueo que se está eliminando.
  const [confirming, setConfirming] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  async function confirm(block: ScheduleBlock) {
    setRemoving(block.id);
    try {
      await onRemove(block);
    } finally {
      setRemoving(null);
      setConfirming(null);
    }
  }

  return (
    <div className="product-table-wrap">
      <table className="product-table">
        <thead>
          <tr>
            <th>Fecha</th><th>Horario</th><th>Sucursal</th><th>Aplica a</th><th>Motivo</th><th>Registrado por</th>
            {canRemove && <th><span className="visually-hidden">Acciones</span></th>}
          </tr>
        </thead>
        <tbody>
          {blocks.map((block) => {
            const label = `${formatDate(block.fecha)} ${block.horaInicio}–${block.horaFin}`;
            return (
              <tr key={block.id}>
                <td>{formatDate(block.fecha)}</td>
                <td>{block.horaInicio}–{block.horaFin}</td>
                <td>{block.sucursal.nombre}</td>
                <td>{block.veterinario ? block.veterinario.nombre : <span className="tag tag-red">Toda la sucursal</span>}</td>
                <td>{block.motivo}</td>
                <td>{block.registradoPor}</td>
                {canRemove && (
                  <td className="block-actions">
                    {confirming === block.id ? (
                      <span className="block-confirm" role="group" aria-label={`Confirmar eliminación del bloqueo ${label}`}>
                        <span>¿Eliminar?</span>
                        <button className="button button--danger" type="button" disabled={removing === block.id} onClick={() => void confirm(block)}>
                          {removing === block.id ? 'Eliminando…' : 'Sí, eliminar'}
                        </button>
                        <button className="button button--ghost" type="button" disabled={removing === block.id} onClick={() => setConfirming(null)}>No</button>
                      </span>
                    ) : (
                      <button className="button button--ghost" type="button" aria-label={`Eliminar el bloqueo ${label}`} onClick={() => setConfirming(block.id)}>
                        Eliminar
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
