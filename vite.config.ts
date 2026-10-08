import {defineConfig, type Plugin} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// The timetable is bundled as the first-open fallback (page.tsx, seed). The server rebuilds the site every 15 minutes
// and each check stamps new times into source.json: bundled as is, every rebuild was a "new version" of the app,
// and phones re-downloaded the whole app in the background and showed «Сайт обновился». The bundled copy keeps only
// what changes with the timetable itself (stamped with the time the timetable last changed); the fresh check
// times come from source.json, which the page fetches anyway.
function stableSeed():Plugin {
  return {
    name:'vmk-stable-seed',
    enforce:'pre', // before Vite's JSON plugin: the file is still JSON here
    transform(code, id) {
      if (!id.replace(/\\/g, '/').endsWith('/public/source.json')) return null;
      const snapshot = JSON.parse(code);
      const at = snapshot.schedule?.savedAt || snapshot.attemptedAt;
      snapshot.attemptedAt = at; snapshot.checkedAt = at;
      if (snapshot.faculty) delete snapshot.faculty.checkedAt;
      return {code:JSON.stringify(snapshot), map:null};
    },
  };
}

export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [stableSeed(), react()],
  resolve: {alias: {'@': path.resolve(__dirname)}},
  build: {outDir: 'dist'},
});
