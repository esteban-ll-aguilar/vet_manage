import { ToastProvider } from '../common/components/toast';
import { AuthProvider } from '../modules/auth/auth-provider';
import { AppRouter } from './router';

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
