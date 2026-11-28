import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppointmentRegisterPage } from './appointment-register-page';

// Registro desde la lista o una franja del calendario; guardar sigue validando disponibilidad.
export function AppointmentRegisterRoute() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  return <AppointmentRegisterPage
    onBack={() => navigate('/appointments/appointments')}
    backLabel="Volver a citas"
    initialSelection={{
      sucursalId: params.get('sucursalId') ?? '',
      fecha: params.get('fecha') ?? '',
      horaInicio: params.get('horaInicio') ?? '',
    }}
  />;
}
