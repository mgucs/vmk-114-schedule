import {defineConfig, type Plugin} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

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

// The version shown in the app: when its code last changed (data commits from the server are left out).
// Needs the history: the server's checkout has only the last commit, so it is fetched first. Empty without git.
function appDate() {
  const git = (...args:string[]) => execFileSync('git', args, {encoding:'utf8'}).trim();
  const data = ['source.json','latest.pdf','archive','people.json','csdrive.json','initial.json','scsd.json'].map(p => `:(exclude)public/${p}`);
  try {
    if (git('rev-parse','--is-shallow-repository')==='true') git('fetch','--quiet','--unshallow');
    return git('log','-1','--format=%cI','--','.',...data);
  } catch { return ''; }
}

export default defineConfig({
  base: process.env.VITE_BASE || '/',
  define: {__APP_DATE__: JSON.stringify(appDate())},
  plugins: [stableSeed(), react()],
  resolve: {alias: {'@': path.resolve(__dirname)}},
  build: {outDir: 'dist'},
});
