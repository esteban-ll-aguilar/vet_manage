import { useEffect, useState } from 'react';
import { schedulingApi } from '../services/scheduling-api';
import type { WorkSchedule } from '../types';
import { describeWorkingHours } from './working-hours';
import './working-hours-hint.css';

type Props = {
  sucursalId: string;
  veterinarioId: string;
  fecha: string;
};

// Muestra la jornada del veterinario elegido para que la recepción elija una hora dentro de ella.
export function WorkingHoursHint({ sucursalId, veterinarioId, fecha }: Props) {
  const key = sucursalId && veterinarioId ? `${sucursalId}:${veterinarioId}` : '';
  const [loaded, setLoaded] = useState<{ key: string; schedules: WorkSchedule[] } | null>(null);

  useEffect(() => {
    if (!key) return;
    let active = true;
    schedulingApi
      .listWorkSchedules({ veterinarioId, sucursalId })
      .then((schedules) => {
        if (active) setLoaded({ key, schedules });
      })
      .catch(() => {
        if (active) setLoaded({ key, schedules: [] });
      });
    return () => {
      active = false;
    };
  }, [key, sucursalId, veterinarioId]);

  if (!key || !fecha || loaded?.key !== key) return null;

  const summary = describeWorkingHours(loaded.schedules, fecha);
  if (!summary) return null;

  return (
    <p className={`form-grid__full working-hours-hint working-hours-hint--${summary.tone}`} role="status">
      {summary.text}
    </p>
  );
}
