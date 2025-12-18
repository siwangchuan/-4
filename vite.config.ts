import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: true,
        allowedHosts: true,
      },
      plugins: [react()],
      define: {
        'process.env.DASHSCOPE_API_KEY': JSON.stringify(env.DASHSCOPE_API_KEY),
        'process.env.API_KEY': JSON.stringify(env.DASHSCOPE_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
