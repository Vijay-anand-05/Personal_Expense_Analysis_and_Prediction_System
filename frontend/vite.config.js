import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // strictPort: fail loudly instead of silently moving to another port,
  // because the backend's CORS setting expects http://localhost:5173.
  server: { port: 5173, strictPort: true, host: 'localhost' },
});
