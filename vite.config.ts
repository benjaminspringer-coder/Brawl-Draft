import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@assets': path.resolve(__dirname, 'attached_assets'),
        '@workspace/db': path.resolve(__dirname, 'lib/db/src/index.ts'),
        '@workspace/api-client-react': path.resolve(__dirname, 'lib/api-client-react/src/index.ts'),
        '@workspace/api-zod': path.resolve(__dirname, 'lib/api-zod/src/index.ts'),
        '@workspace/integrations-gemini-ai': path.resolve(__dirname, 'lib/integrations-gemini-ai/src/index.ts'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
