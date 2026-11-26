import { useEffect, useState, type FormEvent } from 'react';
import { schedulingApi } from '../services/scheduling-api';
import type { AvailableResources, Branch } from '../types';

function getToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? '';

  return `${value('year')}-${value('month')}-${value('day')}`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Ocurrió un error al consultar los recursos.';
}

function formatDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;

  const date = new Date(Date.UTC(year, month - 1, day, 12));

  return new Intl.DateTimeFormat('es-EC', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatEndTime(hora: string, duracionMin: number): string {
  const [hours, minutes] = hora.split(':').map(Number);
  const total = hours * 60 + minutes + duracionMin;

  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(
    total % 60,
  ).padStart(2, '0')}`;
}

const panelStyle = {
  border: '1px solid #e4e7ec',
  borderRadius: '14px',
  padding: '20px',
  background: '#ffffff',
};

export function ResourcesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [sucursalId, setSucursalId] = useState('');
  const [fecha, setFecha] = useState(getToday);
  const [hora, setHora] = useState('09:00');
  const [duracionMin, setDuracionMin] = useState(30);

  const [loadingBranches, setLoadingBranches] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AvailableResources | null>(null);

  useEffect(() => {
    let active = true;

    async function loadBranches() {
      try {
        const data = await schedulingApi.listBranches();
        if (!active) return;

        setBranches(data);
        if (data.length > 0) setSucursalId(data[0].id);
      } catch (err) {
        if (active) setError(getErrorMessage(err));
      } finally {
        if (active) setLoadingBranches(false);
      }
    }

    void loadBranches();

    return () => {
      active = false;
    };
  }, []);

  function clearResult() {
    setResult(null);
    setError('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setResult(null);

    if (!sucursalId) {
      setError('Selecciona una sucursal.');
      return;
    }

    if (!fecha || !hora) {
      setError('Selecciona una fecha y una hora.');
      return;
    }

    if (fecha < getToday()) {
      setError('No puedes consultar una fecha pasada.');
      return;
    }

    if (
      !Number.isInteger(duracionMin) ||
      duracionMin < 30 ||
      duracionMin % 30 !== 0
    ) {
      setError(
        'La duración debe ser de al menos 30 minutos, en intervalos de 30.',
      );
      return;
    }

    setLoading(true);

    try {
      const data = await schedulingApi.consultAvailableResources({
        sucursalId,
        fecha,
        hora,
        duracionMin,
      });

      setResult(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="inventory-page hu006-resources">
      <header className="page-heading">
        <div>
          <p className="eyebrow">AGENDA · RECURSOS</p>
          <h1>Consultar recursos disponibles</h1>
          <p>
            Consulta veterinarios y consultorios libres según la sucursal,
            fecha y horario de atención.
          </p>
        </div>
      </header>

      <section className="catalog-card" style={{ padding: "28px" }}>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '20px',
              marginBottom: '28px',
            }}
          >
            <label className="field">
              <span>Sucursal *</span>
              <select
                value={sucursalId}
                onChange={(event) => {
                  setSucursalId(event.target.value);
                  clearResult();
                }}
                disabled={loadingBranches || loading}
                required
              >
                <option value="">
                  {loadingBranches
                    ? 'Cargando sucursales...'
                    : 'Selecciona una sucursal'}
                </option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Fecha *</span>
              <input
                type="date"
                value={fecha}
                min={getToday()}
                onChange={(event) => {
                  setFecha(event.target.value);
                  clearResult();
                }}
                disabled={loading}
                required
              />
            </label>

            <label className="field">
              <span>Hora *</span>
              <input
                type="time"
                value={hora}
                step={1800}
                onChange={(event) => {
                  setHora(event.target.value);
                  clearResult();
                }}
                disabled={loading}
                required
              />
            </label>

            <label className="field">
              <span>Duración *</span>
              <select
                value={duracionMin}
                onChange={(event) => {
                  setDuracionMin(Number(event.target.value));
                  clearResult();
                }}
                disabled={loading}
              >
                <option value={30}>30 minutos</option>
                <option value={60}>60 minutos</option>
                <option value={90}>90 minutos</option>
                <option value={120}>120 minutos</option>
              </select>
            </label>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              paddingTop: '4px',
              paddingBottom: '8px',
            }}
          >
            <button
              className="button button--primary"
              type="submit"
              disabled={loading || loadingBranches || branches.length === 0}
            >
              {loading ? 'Consultando...' : 'Consultar disponibilidad'}
            </button>
          </div>
        </form>

        {!loadingBranches && branches.length === 0 && !error && (
          <div className="empty-state" style={{ marginTop: '20px' }}>
            No hay sucursales disponibles para consultar.
          </div>
        )}

        {error && (
          <div
            role="alert"
            style={{
              marginTop: '20px',
              padding: '14px 16px',
              background: '#fff1f0',
              border: '1px solid #fecdca',
              borderRadius: '10px',
              color: '#b42318',
              fontWeight: 500,
            }}
          >
            {error}
          </div>
        )}
      </section>

      {result && (
        <section className="catalog-card" style={{ marginTop: '24px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '16px',
              borderRadius: '12px',
              background: '#ffffff',
              border: '1px solid #e4e7ec',
              marginBottom: '22px',
            }}
          >
            <div
              aria-hidden="true"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: '#f2f4f7',
                color: result.disponible ? '#067647' : '#c2410c',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                fontWeight: 700,
                fontSize: '22px',
                flexShrink: 0,
              }}
            >
              {result.disponible ? '✓' : '!'}
            </div>

            <div>
              <h2
                role="status"
                style={{
                  margin: 0,
                  fontSize: '17px',
                  color: result.disponible ? '#067647' : '#9a3412',
                }}
              >
                {result.disponible
                  ? 'Recursos disponibles'
                  : 'Sin disponibilidad en el intervalo seleccionado'}
              </h2>
              <p
                style={{
                  margin: '5px 0 0',
                  fontSize: '13px',
                  color: '#475467',
                }}
              >
                {formatDate(result.fecha)} · {result.hora} a{' '}
                {formatEndTime(result.hora, result.duracionMin)}
              </p>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '18px',
            }}
          >
            <div style={panelStyle}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '18px',
                }}
              >
                <h3 style={{ margin: 0, fontSize: '16px' }}>
                  Veterinarios
                </h3>
                <span
                  style={{
                    background: '#f2f4f7',
                    color: '#344054',
                    borderRadius: '20px',
                    padding: '5px 10px',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  {result.veterinarios.length} disponibles
                </span>
              </div>

              {result.veterinarios.length > 0 ? (
                <ul
                  style={{
                    listStyle: 'none',
                    margin: 0,
                    padding: 0,
                    display: 'grid',
                    gap: '10px',
                  }}
                >
                  {result.veterinarios.map((vet) => (
                    <li
                      key={vet.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '12px',
                        background: '#ffffff',
                        border: '1px solid #eaecf0',
                        borderRadius: '10px',
                      }}
                    >

                      <span style={{ flex: 1, fontSize: '14px' }}>
                        {vet.nombre}
                      </span>
                      <span
                        aria-label="Disponible"
                        title="Disponible"
                        style={{ color: '#079455', fontWeight: 700 }}
                      >
                        ✓
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ color: '#667085', fontSize: '14px' }}>
                  No hay veterinarios libres para este horario.
                </p>
              )}
            </div>

            <div style={panelStyle}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '18px',
                }}
              >
                <h3 style={{ margin: 0, fontSize: '16px' }}>
                  Consultorios
                </h3>
                <span
                  style={{
                    background: '#f2f4f7',
                    color: '#344054',
                    borderRadius: '20px',
                    padding: '5px 10px',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  {result.consultorios.length} disponibles
                </span>
              </div>

              {result.consultorios.length > 0 ? (
                <ul
                  style={{
                    listStyle: 'none',
                    margin: 0,
                    padding: 0,
                    display: 'grid',
                    gap: '10px',
                  }}
                >
                  {result.consultorios.map((room) => (
                    <li
                      key={room.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '12px',
                        background: '#ffffff',
                        border: '1px solid #eaecf0',
                        borderRadius: '10px',
                      }}
                    >

                      <span style={{ flex: 1, fontSize: '14px' }}>
                        {room.nombre}
                      </span>
                      <span
                        aria-label="Disponible"
                        title="Disponible"
                        style={{ color: '#079455', fontWeight: 700 }}
                      >
                        ✓
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ color: '#667085', fontSize: '14px' }}>
                  No hay consultorios libres para este horario.
                </p>
              )}
            </div>
          </div>

          {!result.disponible && (
            <p
              style={{
                marginTop: '18px',
                marginBottom: 0,
                color: '#9a3412',
                fontSize: '14px',
              }}
            >
              Selecciona otra fecha, hora o sucursal para encontrar
              recursos disponibles.
            </p>
          )}
        </section>
      )}
      <style>{`
        .hu006-resources .catalog-card {
          box-sizing: border-box;
        }
        .hu006-resources .field {
          min-width: 0;
        }
        .hu006-resources .field input,
        .hu006-resources .field select {
          box-sizing: border-box;
          width: 100%;
          min-width: 0;
        }
        @media (max-width: 640px) {
          .hu006-resources .catalog-card {
            padding: 20px !important;
          }
          .hu006-resources .button--primary {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
