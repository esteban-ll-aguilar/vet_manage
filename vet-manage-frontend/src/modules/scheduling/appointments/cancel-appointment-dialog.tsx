import { useEffect, useRef, useState, type FormEvent } from 'react';
import { formatAppointmentDate } from './appointments-utils';
import type { Appointment } from './types';

type CancelAppointmentDialogProps = {
  appointment: Appointment;
  onClose: () => void;
  onConfirm: (motivo: string) => Promise<void>;
};

export function CancelAppointmentDialog({
  appointment,
  onClose,
  onConfirm,
}: CancelAppointmentDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();

    return () => {
      dialog?.close();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    const reason = motivo.trim();

    if (!reason) {
      setError('Ingrese el motivo de cancelación');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await onConfirm(reason);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'No se pudo cancelar la cita.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="appointment-dialog"
      aria-labelledby="cancel-appointment-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!loading) onClose();
      }}
    >
      <div className="appointment-dialog__heading">
        <span className="eyebrow">AGENDA · CANCELACIÓN</span>

        <h2 id="cancel-appointment-title">
          Cancelar cita #{appointment.numero}
        </h2>

        <p>
          Confirma los datos de la cita e indica el motivo
          de cancelación.
        </p>
      </div>

      <div className="appointment-summary">
        <div>
          <span>Paciente</span>
          <strong>{appointment.paciente}</strong>
        </div>

        <div>
          <span>Fecha y hora</span>
          <strong>
            {formatAppointmentDate(appointment.fechaHora)}
          </strong>
        </div>

        <div>
          <span>Veterinario</span>
          <strong>{appointment.veterinario}</strong>
        </div>

        <div>
          <span>Sucursal</span>
          <strong>{appointment.sucursal}</strong>
        </div>
      </div>

      <div className="appointment-warning">
        La cancelación liberará los recursos asociados a
        la cita y conservará el registro de la operación.
      </div>

      <form onSubmit={(event) => void handleSubmit(event)}>
        <label className="field">
          <span>Motivo de cancelación *</span>

          <textarea
            value={motivo}
            onChange={(event) => {
              setMotivo(event.target.value);
              setError('');
            }}
            placeholder="Ingrese el motivo de cancelación"
            rows={4}
            disabled={loading}
            aria-required="true"
          />
        </label>

        {error && (
          <div className="appointment-error" role="alert">
            {error}
          </div>
        )}

        <div className="appointment-dialog__actions">
          <button
            type="button"
            className="button button--ghost"
            disabled={loading}
            onClick={onClose}
          >
            Volver
          </button>

          <button
            type="submit"
            className="button button--danger"
            disabled={loading}
          >
            {loading
              ? 'Cancelando…'
              : 'Confirmar cancelación'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
