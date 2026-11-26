import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastContext } from '../../../common/components/toast-context';
import { usersApi } from '../services/users-api';
import { UserRegisterPage } from './user-register-page';

vi.mock('../services/users-api', () => ({
  usersApi: {
    assignableRoles: vi.fn(),
    register: vi.fn(),
  },
}));

function renderPage() {
  return render(
    <ToastContext.Provider value={{ showToast: vi.fn(), dismissToast: vi.fn(), confirm: vi.fn(async () => true) }}>
      <MemoryRouter>
        <UserRegisterPage />
      </MemoryRouter>
    </ToastContext.Provider>,
  );
}

describe('UserRegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usersApi.assignableRoles).mockResolvedValue([
      { name: 'veterinarian', displayName: 'Veterinario', description: null },
    ]);
  });

  it('solo deja escribir números en el teléfono y conserva el "+" inicial', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/Teléfono/), '+593 99a-222 2222');

    expect(screen.getByLabelText(/Teléfono/)).toHaveValue('+593992222222');
    expect(screen.getByLabelText(/Teléfono/)).toHaveAttribute('maxLength', '16');
  });
});
