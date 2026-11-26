import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../../../infrastructure/api/http-client';
import { useAuth } from '../../auth/auth-context';
import { schedulingApi } from '../services/scheduling-api';
import type { Branch } from '../types';
import { ratesApi, type Rate, type RateService } from './rates-api';
import { useToast } from '../../../common/components/toast-context';


export const INVALID_RATE_MESSAGE = 'Ingrese un importe mayor a cero con hasta dos decimales';
export const REQUIRED_RATE_MESSAGE = 'El campo tarifa es obligatorio';
export const FORBIDDEN_RATE_MESSAGE = 'No tiene permisos para esta acción';

function globalErrorMessage(cause: unknown, fallback: string) {
  if (cause instanceof ApiError && cause.status === 403) return FORBIDDEN_RATE_MESSAGE;
  if (cause instanceof ApiError && cause.status >= 500) return cause.message || fallback;
  if (cause instanceof TypeError) return fallback;
  return '';
}

function operationErrorMessage(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

export function RatesPage() {
  const { hasPermission } = useAuth();
  const canRead = hasPermission('rates:read');
  const canManage = hasPermission('rates:manage');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [services, setServices] = useState<RateService[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [branchId, setBranchId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [amount, setAmount] = useState('');
  const amountInput = useRef<HTMLInputElement>(null);
  const [amountError, setAmountError] = useState('');
  const [globalError, setGlobalError] = useState('');
  const [operationError, setOperationError] = useState('');
  const [message, setMessage] = useState('');
  const [updatingServiceId, setUpdatingServiceId] = useState('');
  const { showToast, confirm } = useToast();

  useEffect(() => {
    if (!canRead) return;
    void Promise.all([schedulingApi.listBranches(), ratesApi.listServices(), ratesApi.list()])
      .then(([branchItems, serviceItems, rateItems]) => {
        setBranches(branchItems);
        setServices(serviceItems);
        setRates(rateItems);
        if (branchItems[0]) setBranchId(branchItems[0].id);
        setServiceId(serviceItems.find((service) => service.estado)?.id ?? serviceItems[0]?.id ?? '');
      })
      .catch((cause: unknown) => {
        const globalError = globalErrorMessage(cause, 'No se pudo cargar el catálogo de tarifas');
        setGlobalError(globalError);
        setOperationError(globalError ? '' : operationErrorMessage(cause, 'No se pudo cargar el catálogo de tarifas'));
      });
  }, [canRead]);

  const tableRows = useMemo(() => branches.flatMap((branch) => services.map((service) => {
    const serviceRates = rates.filter((rate) => rate.sucursalId === branch.id && rate.servicioId === service.id);
    const rate = serviceRates.find((item) => item.estado) ?? serviceRates[0];
    return { branch, service, rate };
  })), [branches, services, rates]);

  function parseAmount(raw: string): number | null {
    if (raw.trim() === '') {
      setAmountError(REQUIRED_RATE_MESSAGE);
      return null;
    }
    const normalized = raw.trim().replace(',', '.');
    if (!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) {
      setAmountError(INVALID_RATE_MESSAGE);
      return null;
    }
    const decimalPart = normalized.includes('.') ? normalized.split('.')[1] : '';
    if (decimalPart.length > 2) {
      setAmountError(INVALID_RATE_MESSAGE);
      return null;
    }
    const value = Number(normalized);
    if (!Number.isFinite(value) || value <= 0) {
      setAmountError(INVALID_RATE_MESSAGE);
      return null;
    }
    return value;
  }

  async function save() {
    setGlobalError('');
    setOperationError('');
    setMessage('');
    setAmountError('');
    if (!canManage) {
      setGlobalError(FORBIDDEN_RATE_MESSAGE);
      return;
    }
    if (!branchId || !serviceId) return;
    if (amountInput.current?.validity.badInput) {
      setAmountError(INVALID_RATE_MESSAGE);
      return;
    }
    const value = parseAmount(amount);
    if (value === null) return;
    const active = rates.find((rate) => rate.servicioId === serviceId
      && rate.sucursalId === branchId
      && rate.estado);
    try {
      const saved = active
        ? await ratesApi.update(active.id, value)
        : await ratesApi.save({ servicioId: serviceId, sucursalId: branchId, importe: value });
      setRates((current) => active
        ? current.map((rate) => rate.id === active.id ? { ...rate, estado: false } : rate).concat(saved)
        : [...current, saved]);
      setAmount('');
      setMessage('Tarifa guardada correctamente');
    } catch (cause) {
      const globalError = globalErrorMessage(cause, 'No se pudo guardar la tarifa');
      setGlobalError(globalError);
      setOperationError(globalError ? '' : operationErrorMessage(cause, 'No se pudo guardar la tarifa'));
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void save();
  }

  async function toggleService(service: RateService) {
    if (!canManage) {
      setGlobalError(FORBIDDEN_RATE_MESSAGE);
      return;
    }
    //'button--danger-soft' : 'button--success-soft
    const accepted = await confirm(
      service.estado
        ? '¿Estás seguro de que deseas desactivar este servicio?'
        : '¿Deseas activar este servicio?',
      service.estado ? 'Sí, Activar' : 'Sí, Desactivar',
      service.estado ? 'success' : 'danger'
    );

    if (!accepted) return;

    setGlobalError('');
    setOperationError('');
    setMessage('');
    setUpdatingServiceId(service.id);
    try {
      const updated = service.estado
        ? await ratesApi.deactivateService(service.id)
        : await ratesApi.activateService(service.id);
      setServices((current) => current.map((item) => item.id === service.id
        ? { ...item, estado: updated.estado }
        : item));
      if (updated.estado) {
        setServiceId(updated.id);
      } else if (serviceId === service.id) {
        setServiceId(services.find((item) => item.id !== service.id && item.estado)?.id ?? '');
      }
      setMessage(updated.estado ? 'Servicio activado correctamente' : 'Servicio inactivado correctamente');
      showToast(updated.estado ? 'Servicio activado correctamente' : 'Servicio inactivado correctamente');
    } catch (cause) {
      const globalError = globalErrorMessage(cause, 'No se pudo actualizar el estado del servicio');
      setGlobalError(globalError);
      setOperationError(globalError ? '' : operationErrorMessage(cause, 'No se pudo actualizar el estado del servicio'));
    } finally {
      setUpdatingServiceId('');
    }
  }

  if (!canRead) {
    return <section className="empty-page" role="alert"><h2>{FORBIDDEN_RATE_MESSAGE}</h2></section>;
  }

  return (
    <section className="scheduling-page">
      <div className="page-heading">
        <div><span className="eyebrow">Agenda</span><h2>Tarifas</h2><p>Mantenga el catálogo de tarifas por sucursal y servicio.</p></div>
      </div>
      {globalError && <p className="form-error" role="alert">{globalError}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
      <form className="rates-form" onSubmit={handleSubmit} noValidate>
        <label className="field"><span>Sucursal</span>
          <select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.nombre}</option>)}
          </select>
        </label>
        <label className="field"><span>Servicio</span>
          <select value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
            {services.map((service) => <option key={service.id} value={service.id}>{service.nombre}</option>)}
          </select>
        </label>
        <label className="field"><span>Tarifa USD <b>*</b></span>
          <input
            ref={amountInput}
            aria-label="Tarifa USD"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setAmountError('');
            }}
            placeholder="20.00"
            aria-invalid={Boolean(amountError)}
            aria-describedby={amountError ? 'rate-amount-error' : undefined}
          />
          {amountError && <small id="rate-amount-error" className="field-error" role="alert">{amountError}</small>}
        </label>
        <button
          type="submit"
          className="button button--primary mt-4"
          disabled={!branchId || !serviceId}
        >
          Guardar
        </button>
        {operationError && <p className="field-error" role="alert">{operationError}</p>}
      </form>
      <div className="product-table-wrap">
        <table className="product-table" aria-label="Tarifas">
          <thead>
            <tr><th>Sucursal</th><th>Servicio</th><th>Tarifa</th><th>Estado</th>{canManage && <th>Acciones</th>}</tr>
          </thead>
          <tbody>
            {tableRows.map(({ branch, service, rate }) => {
              const isActive = service.estado && Boolean(rate?.estado);
              return (
                <tr key={`${branch.id}-${service.id}`}>
                  <td>{branch.nombre}</td>
                  <td>{service.nombre}</td>
                  <td className="price-cell">{rate ? `USD ${Number(rate.importe).toFixed(2)}` : 'Sin tarifa'}</td>
                  <td><span className={`tag  ${service.estado ? 'tag-green' : 'tag-red'
                          }`}>{isActive ? 'Activa' : 'Inactiva'}</span></td>
                  {canManage && (
                    <td>
                      <button
                        type="button"
                        aria-label={service.estado ? 'Inactivar servicio' : 'Activar servicio'}
                        className={`button button--small ${service.estado ? 'button--danger-soft' : 'button--success-soft'
                          }`}
                        onClick={() => {
                          //const action = service.estado ? 'inactivar' : 'activar';

                          /*const confirmed = window.confirm(
                            `¿Estás seguro de que deseas ${action} el servicio "${service.nombre}"?`
                          );

                          if (confirmed) {*/
                          void toggleService(service);
                          //}
                        }}
                        disabled={updatingServiceId === service.id}
                      >
                        {service.estado ? 'Inactivar servicio' : 'Activar servicio'}
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!canManage && operationError && <p className="field-error" role="alert">{operationError}</p>}
    </section>
  );
}
