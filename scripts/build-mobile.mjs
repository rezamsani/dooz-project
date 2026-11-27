import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { publicRuntimeSettings, readProjectSettings } from '../src/project-settings.cjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const envFile = new URL('../.env.mobile', import.meta.url);
const legacyMobileEnv = existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf8')) : {};
const settings = publicRuntimeSettings(readProjectSettings(root), { mobile: true, legacyMobileEnv });

const build = spawnSync(process.execPath, ['node_modules/@angular/cli/bin/ng.js', 'build', '--configuration=mobile'], {
  cwd: root, stdio: 'inherit', env: { ...process.env, NG_CLI_ANALYTICS: 'false' },
});
if (build.error) console.error(build.error);
if (build.status !== 0) process.exit(build.status ?? 1);

writeFileSync(new URL('../dist/mobile/browser/runtime-config.json', import.meta.url), `${JSON.stringify(settings, null, 2)}\n`);
console.log(settings.onlineServerUrl
  ? `Mobile build ready. Online server: ${settings.onlineServerUrl}`
  : 'Mobile build ready for offline play. Set online.mobileServerUrl in appsettings.json to enable online play.');
