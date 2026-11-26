import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const envFile = new URL('../.env.mobile', import.meta.url);
if (existsSync(envFile)) loadEnvFile(fileURLToPath(envFile));

const settings = JSON.parse(readFileSync(new URL('../public/runtime-config.json', import.meta.url), 'utf8'));
settings.onlineServerUrl = process.env.DOOZ_ONLINE_URL ?? settings.onlineServerUrl;
settings.publicWebUrl = process.env.DOOZ_PUBLIC_WEB_URL ?? settings.publicWebUrl;
for (const key of ['onlineServerUrl', 'publicWebUrl']) {
  if (!settings[key]) continue;
  const url = new URL(settings[key]);
  if (url.protocol !== 'https:' || url.pathname !== '/' || url.username || url.password || url.search || url.hash) {
    throw new Error(`${key} must be an HTTPS origin, for example https://play.example.com`);
  }
  settings[key] = url.origin;
}

const build = spawnSync(process.execPath, ['node_modules/@angular/cli/bin/ng.js', 'build', '--configuration=mobile'], {
  cwd: root, stdio: 'inherit', env: { ...process.env, NG_CLI_ANALYTICS: 'false' },
});
if (build.error) console.error(build.error);
if (build.status !== 0) process.exit(build.status ?? 1);

writeFileSync(new URL('../dist/mobile/browser/runtime-config.json', import.meta.url), `${JSON.stringify(settings, null, 2)}\n`);
console.log(settings.onlineServerUrl
  ? `Mobile build ready. Online server: ${settings.onlineServerUrl}`
  : 'Mobile build ready for offline play. Set DOOZ_ONLINE_URL when an HTTPS game server is available.');
