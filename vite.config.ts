import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    // Tells Vite your site lives in the /portfolio/ subfolder on GitHub
    base: '/portfolio/', 
    
    // Cleaned out the React plugin completely since you're using pure vanilla JS/CSS
    plugins: [], 
    
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // Kept environment checks intact for the workspace runner
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});