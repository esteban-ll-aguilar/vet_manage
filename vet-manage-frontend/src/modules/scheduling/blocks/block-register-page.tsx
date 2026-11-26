import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '../../../common/components/toast-context';
import { schedulingApi } from '../services/scheduling-api';
import type { Branch } from '../types';
import { BlockForm } from './block-form';
import { blocksApi } from './blocks-api';
import type { ScheduleBlockDraft, Veterinarian } from './types';
import './blocks.css';

export const BLOCKS_PATH = '/appointments/blocks';

export function BlockRegisterPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [veterinarians, setVeterinarians] = useState<Veterinarian[]>([]);

  useEffect(() => {
    let active = true;
    Promise.all([schedulingApi.listBranches(), blocksApi.listVeterinarians()])
      .then(([loadedBranches, loadedVets]) => {
        if (!active) return;
        setBranches(loadedBranches);
        setVeterinarians(loadedVets);
      })
      .catch(() => { if (active) showToast('No se pudieron cargar las sucursales y los veterinarios.', 'error'); });
    return () => { active = false; };
  }, [showToast]);

  // Si la API rechaza el bloqueo, el error vuelve al formulario para mostrarlo.
  async function register(draft: ScheduleBlockDraft) {
    await blocksApi.create(draft);
    showToast('Bloqueo registrado correctamente', 'success');
    navigate(BLOCKS_PATH);
  }

  return (
    <section className="inventory-page inventory-form-page blocks-page">
      <Link className="back-link" to={BLOCKS_PATH}>← Volver a bloqueos</Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Agenda · Bloqueos</span>
          <h2>Registrar bloqueo</h2>
          <p>Impide reservas durante una ausencia o un mantenimiento. Un bloqueo no cancela citas: si afecta una, no se guarda.</p>
        </div>
      </div>

      <BlockForm branches={branches} veterinarians={veterinarians} onSubmit={register} cancelTo={BLOCKS_PATH} />
    </section>
  );
}
