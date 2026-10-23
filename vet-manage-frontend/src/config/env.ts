const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3080/api/v1';

export const env = {
  apiUrl: apiUrl.replace(/\/$/, ''),
};
