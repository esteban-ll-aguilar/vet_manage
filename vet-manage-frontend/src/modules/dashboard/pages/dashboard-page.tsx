import { useEffect, useState } from 'react';
import { StatusDot } from '../../../common/components/status-dot';
import { getJson } from '../../../infrastructure/api/http-client';
import { useAuth } from '../../auth/auth-context';
import { ExpirationAlertsPanel } from '../../inventory/components/expiration-alerts-panel';
import { inventoryApi } from '../../inventory/services/inventory-api';
import type { ExpirationAlert } from '../../inventory/types';

type HealthResponse = { status: string };

const metrics = [
  { label: 'Citas de hoy', value: '12', note: '+3 frente a ayer', tone: 'blue' },
  { label: 'Pacientes activos', value: '248', note: '8 nuevos este mes', tone: 'green' },
  { label: 'Consultas pendientes', value: '07', note: 'Requieren seguimiento', tone: 'orange' },
];

export function DashboardPage() {
  const { hasPermission } = useAuth();
  const [apiStatus, setApiStatus] = useState<'loading' | 'online' | 'offline'>('loading');
  const [expirationAlerts, setExpirationAlerts] = useState<ExpirationAlert[]>([]);
  const [expirationAlertsState, setExpirationAlertsState] = useState<'loading' | 'error' | 'success'>('loading');
  const [expirationAlertsRefreshKey, setExpirationAlertsRefreshKey] = useState(0);

  function refreshExpirationAlerts() {
    setExpirationAlertsState('loading');
    setExpirationAlertsRefreshKey((key) => key + 1);
  }

  async function saveBatchExpiration(lotId: string, expirationDate: string) {
    await inventoryApi.updateBatchExpiration(lotId, expirationDate);
    refreshExpirationAlerts();
  }

  useEffect(() => {
    getJson<HealthResponse>('/health')
      .then((health) => setApiStatus(health.status === 'ok' ? 'online' : 'offline'))
      .catch(() => setApiStatus('offline'));
  }, []);

  useEffect(() => {
    let active = true;
    inventoryApi.listExpirationAlerts()
      .then((alerts) => {
        if (!active) return;
        setExpirationAlerts(alerts);
        setExpirationAlertsState('success');
      })
      .catch(() => {
        if (active) setExpirationAlertsState('error');
      });

    return () => { active = false; };
  }, [expirationAlertsRefreshKey]);

  return (
    <div className="dashboard">
      <section className="welcome-card">
        <div>
          <span className="eyebrow">Jueves, 23 de octubre de 2026</span>
          <h2>Buenos días, equipo</h2>
          <p>Este es el resumen de actividad de tu clínica.</p>
        </div>
        <div className="welcome-icon">✦</div>
      </section>

      <section className="metric-grid" aria-label="Métricas principales">
        {metrics.map((metric) => (
          <article className="metric-card" key={metric.label}>
            <div className={`metric-icon metric-icon--${metric.tone}`} />
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.note}</small>
          </article>
        ))}
      </section>

      <section className="content-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Próximas horas</span>
              <h3>Agenda de hoy</h3>
            </div>
            <button className="text-button" type="button">Ver agenda</button>
          </div>
          <div className="appointment-list">
            <div className="appointment-row"><strong>09:00</strong><span className="appointment-avatar avatar-blue">LM</span><div><b>Luna Martínez</b><small>Consulta general · Dra. Valentina Ruiz</small></div><span className="tag tag-green">Confirmada</span></div>
            <div className="appointment-row"><strong>10:30</strong><span className="appointment-avatar avatar-purple">TO</span><div><b>Toby Ortega</b><small>Vacunación · Dr. Diego Reyes</small></div><span className="tag tag-orange">Pendiente</span></div>
            <div className="appointment-row"><strong>12:00</strong><span className="appointment-avatar avatar-yellow">NS</span><div><b>Nala Sánchez</b><small>Control · Dra. Valentina Ruiz</small></div><span className="tag tag-green">Confirmada</span></div>
          </div>
        </article>

        <article className="panel quick-panel">
          <div className="panel-heading"><div><span className="eyebrow">Acciones</span><h3>Accesos rápidos</h3></div></div>
          <button className="quick-action" type="button"><span>＋</span><div><b>Registrar paciente</b><small>Agrega una nueva mascota</small></div></button>
          <button className="quick-action" type="button"><span>◷</span><div><b>Crear cita</b><small>Organiza la agenda del equipo</small></div></button>
          <button className="quick-action" type="button"><span>⌁</span><div><b>Buscar historial</b><small>Consulta un registro clínico</small></div></button>
        </article>
      </section>

      <ExpirationAlertsPanel
        alerts={expirationAlerts}
        state={expirationAlertsState}
        onRefresh={refreshExpirationAlerts}
        canEdit={hasPermission('inventory:register-entry')}
        onSaveExpiration={saveBatchExpiration}
      />

      <footer className="system-status"><StatusDot status={apiStatus} /> API {apiStatus === 'online' ? 'conectada' : apiStatus === 'offline' ? 'no disponible' : 'verificando'}</footer>
    </div>
  );
}
