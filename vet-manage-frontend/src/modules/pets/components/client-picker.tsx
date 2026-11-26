import { useEffect, useId, useRef, useState } from 'react';
import { SearchIcon, UserIcon } from '../../../common/components/icons';
import type { ClientOption } from '../types';

interface ClientPickerProps {
  value: ClientOption | null;
  onChange: (client: ClientOption | null) => void;
  search: (term: string) => Promise<ClientOption[]>;
  error?: string;
  disabled?: boolean;
}

type SearchState = 'idle' | 'loading' | 'ready' | 'error';

const SEARCH_DELAY_MS = 300;

const fullName = (client: ClientOption) => `${client.firstName} ${client.lastName}`;

// Buscador de clientes activos por nombre o cédula; solo muestra lo que devuelve la API.
export function ClientPicker({ value, onChange, search, error, disabled = false }: ClientPickerProps) {
  const inputId = useId();
  const [term, setTerm] = useState('');
  const [options, setOptions] = useState<ClientOption[]>([]);
  const [state, setState] = useState<SearchState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastRequest = useRef(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  const handleTermChange = (next: string) => {
    setTerm(next);
    clearTimeout(timer.current);
    const request = ++lastRequest.current;

    if (!next.trim()) {
      setOptions([]);
      setState('idle');
      return;
    }

    setState('loading');
    timer.current = setTimeout(() => {
      search(next)
        .then((found) => {
          // Ignora respuestas de búsquedas anteriores que lleguen tarde.
          if (request !== lastRequest.current) return;
          setOptions(found);
          setState('ready');
        })
        .catch(() => { if (request === lastRequest.current) setState('error'); });
    }, SEARCH_DELAY_MS);
  };

  const choose = (client: ClientOption | null) => {
    handleTermChange('');
    onChange(client);
  };

  if (value) {
    return (
      <div className="field">
        <span>Cliente <b>*</b></span>
        <div className="client-picker__selected">
          <span className="client-picker__avatar"><UserIcon size={16} /></span>
          <span className="client-picker__text">
            <b>{fullName(value)}</b>
            <small>Cédula {value.identification}</small>
          </span>
          <button type="button" className="create-link" onClick={() => choose(null)} disabled={disabled}>
            Cambiar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="field client-picker">
      <label htmlFor={inputId}>Cliente <b>*</b></label>
      <div className="patient-field__control">
        <SearchIcon size={16} />
        <input
          id={inputId}
          type="search"
          value={term}
          onChange={(event) => handleTermChange(event.target.value)}
          placeholder="Buscar por nombre o cédula"
          autoComplete="off"
          disabled={disabled}
          aria-invalid={Boolean(error)}
        />
      </div>
      {state === 'loading' && <small>Buscando clientes...</small>}
      {state === 'error' && <small className="field-error" role="alert">No se pudieron cargar los clientes</small>}
      {state === 'ready' && options.length === 0 && <small>No hay clientes activos que coincidan</small>}
      {state === 'ready' && options.length > 0 && (
        <ul className="client-picker__options" role="listbox" aria-label="Clientes activos">
          {options.map((client) => (
            <li key={client.id} role="option" aria-selected={false}>
              <button type="button" onClick={() => choose(client)}>
                <span className="client-picker__avatar"><UserIcon size={14} /></span>
                <span className="client-picker__text">
                  <b>{fullName(client)}</b>
                  <small>Cédula {client.identification}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <small className="field-error">{error}</small>}
    </div>
  );
}
