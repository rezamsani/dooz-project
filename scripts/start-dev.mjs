import { fork, spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { developmentSettings, readProjectSettings } from '../src/project-settings.cjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const { webPort } = developmentSettings(readProjectSettings(root));
const compile = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.online.json'], {
  cwd: root,
  stdio: 'inherit',
});
if (compile.error) console.error(compile.error);
if (compile.status !== 0) process.exit(compile.status ?? 1);

let angular;
let stopping = false;
const online = fork('out-tsc/online-server/dev-online-server.js', [], {
  cwd: root,
  stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
});

function stop(code) {
  if (stopping) return;
  stopping = true;
  angular?.kill();
  online.kill();
  process.exitCode = code;
}

online.once('message', (message) => {
  if (message?.type !== 'ready' || stopping) return;
  const args = ['node_modules/@angular/cli/bin/ng.js', 'serve', `--port=${webPort}`, ...process.argv.slice(2)];
  if (process.env.DISABLE_HMR) args.push('--live-reload=false');
  angular = spawn(process.execPath, args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, DOOZ_ONLINE_PORT: String(message.port) },
  });
  angular.once('error', (error) => {
    console.error(error);
    stop(1);
  });
  angular.once('exit', (code) => stop(code ?? 1));
});
online.once('error', (error) => {
  console.error(error);
  stop(1);
});
online.once('exit', (code) => stop(code || 1));
process.once('SIGINT', () => stop(0));
process.once('SIGTERM', () => stop(0));
