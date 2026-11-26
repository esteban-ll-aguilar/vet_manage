import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../../../common/components/toast-context';
import { useAuth } from '../../auth/auth-context';
import { schedulingApi } from '../services/scheduling-api';
import type { Branch } from '../types';
import { blocksApi } from './blocks-api';
import { BlocksTable } from './blocks-table';
import type { ScheduleBlock } from './types';
import './blocks.css';

export function BlocksPage() {
  const { hasPermission } = useAuth();
  const { showToast } = useToast();
  const canCreate = hasPermission('schedule-blocks:create');
  const canRemove = hasPermission('schedule-blocks:remove');

  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchFilter, setBranchFilter] = useState('');
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [loading, setLoading] = useState(true);
  // Cambia después de eliminar un bloqueo para volver a cargar la lista.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    schedulingApi.listBranches()
      .then((loaded) => { if (active) setBranches(loaded); })
      .catch(() => { if (active) showToast('No se pudieron cargar las sucursales.', 'error'); });
    return () => { active = false; };
  }, [showToast]);

  useEffect(() => {
    let cancelled = false;
    blocksApi.list(branchFilter)
      .then((loaded) => { if (!cancelled) setBlocks(loaded); })
      .catch(() => { if (!cancelled) showToast('No se pudieron cargar los bloqueos.', 'error'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [branchFilter, reloadKey, showToast]);

  function changeFilter(sucursalId: string) {
    setLoading(true);
    setBranchFilter(sucursalId);
  }

  function reload() {
    setLoading(true);
    setReloadKey((key) => key + 1);
  }

  async function remove(block: ScheduleBlock) {
    try {
      await blocksApi.remove(block.id);
      showToast('Bloqueo eliminado correctamente', 'success');
    } catch (cause) {
      // Si otra persona ya lo eliminó, la API responde "El bloqueo ya no existe".
      showToast(cause instanceof Error ? cause.message : 'No se pudo eliminar el bloqueo.', 'error');
    }
    // En ambos casos se actualiza la lista para mostrar los bloqueos vigentes.
    reload();
  }

  return (
    <section className="inventory-page blocks-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Agenda · Bloqueos</span>
          <h2>Bloqueos de horario</h2>
          <p>Impide reservas durante una ausencia o un mantenimiento. Un bloqueo no cancela citas: si afecta una, no se guarda.</p>
        </div>
        {canCreate && <Link className="button button--primary" to="/appointments/blocks/new">Nuevo bloqueo</Link>}
      </div>

      <div className="catalog-card blocks-list">
        <div className="catalog-card__heading">
          <div><h3>Bloqueos vigentes</h3><p>Ordenados por fecha y hora.</p></div>
          <label className="field blocks-filter">
            <span>Sucursal</span>
            <select value={branchFilter} onChange={(event) => changeFilter(event.target.value)} aria-label="Filtrar por sucursal">
              <option value="">Todas</option>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.nombre}</option>)}
            </select>
          </label>
        </div>

        {loading ? (
          <div className="empty-state">Cargando bloqueos…</div>
        ) : blocks.length === 0 ? (
          <div className="empty-state"><strong>No hay bloqueos vigentes</strong></div>
        ) : (
          <BlocksTable blocks={blocks} canRemove={canRemove} onRemove={remove} />
        )}
      </div>
    </section>
  );
}
