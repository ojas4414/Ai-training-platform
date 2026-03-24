import { execSync } from 'child_process';
import fs from 'fs';

try {
  console.log('Running Vite build...');
  execSync('npx vite build --config vite.config.mjs', { 
    env: { ...process.env, CI: 'true' }, 
    stdio: 'pipe' 
  });
  console.log('Build succeeded.');
} catch (e) {
  const out = e.stdout.toString() + '\n' + e.stderr.toString();
  console.error(out);
  fs.writeFileSync('clean_error.txt', out, 'utf-8');
}
