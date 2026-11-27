const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

function readProjectSettings(directory = process.cwd()) {
  let contents;
  try {
    contents = readFileSync(resolve(directory, 'appsettings.json'), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }

  try {
    const settings = JSON.parse(contents.replace(/^\uFEFF/, ''));
    if (settings && typeof settings === 'object' && !Array.isArray(settings)) return settings;
  } catch {
    // Avoid including portions of a settings file in the error message.
  }
  throw new Error('appsettings.json must contain a valid JSON object.');
}

/** @param {unknown} value */
function port(value, name) {
  const parsed = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof parsed !== 'number' || !Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
    throw new Error(`${name} must be an integer port between 0 and 65535.`);
  }
  return parsed;
}

/** @param {unknown} value */
function origin(value, name, requireHttps) {
  if (value === undefined || value === '') return '';
  try {
    if (typeof value === 'string') {
      const url = new URL(value);
      const validProtocol = url.protocol === 'https:' || (!requireHttps && url.protocol === 'http:');
      if (validProtocol && url.pathname === '/' && !url.username && !url.password && !url.search && !url.hash) {
        return url.origin;
      }
    }
  } catch {
    // The value can contain credentials. Report only the field name.
  }
  throw new Error(`${name} must be ${requireHttps ? 'an HTTPS' : 'an HTTP or HTTPS'} origin.`);
}

function serverSettings(settings = readProjectSettings(), env = process.env) {
  const dataDirectory = env.DOOZ_DATA_DIR ?? settings.server?.dataDirectory ?? '.data';
  if (typeof dataDirectory !== 'string' || !dataDirectory.trim()) {
    throw new Error('server.dataDirectory must be a nonempty path.');
  }
  return {
    port: port(env.PORT ?? settings.server?.port ?? 4000, 'server.port'),
    dataDirectory,
  };
}

function developmentSettings(settings = readProjectSettings(), env = process.env) {
  return {
    webPort: port(settings.development?.webPort ?? 3000, 'development.webPort'),
    onlinePort: port(env.DOOZ_ONLINE_PORT ?? settings.development?.onlinePort ?? 4201, 'development.onlinePort'),
  };
}

/** @param {{ mobile?: boolean, env?: NodeJS.ProcessEnv, legacyMobileEnv?: NodeJS.Dict<string> }} options */
function publicRuntimeSettings(settings = readProjectSettings(), options = {}) {
  const { mobile = false, env = process.env, legacyMobileEnv = {} } = options;
  const online = settings.online;
  const configuredServer = mobile ? (online?.mobileServerUrl || online?.serverUrl) : online?.serverUrl;
  const onlineServerUrl = mobile
    ? (env.DOOZ_ONLINE_URL ?? (configuredServer || legacyMobileEnv.DOOZ_ONLINE_URL))
    : configuredServer;
  const publicWebUrl = mobile
    ? (env.DOOZ_PUBLIC_WEB_URL ?? (online?.publicWebUrl || legacyMobileEnv.DOOZ_PUBLIC_WEB_URL))
    : online?.publicWebUrl;

  return {
    onlineServerUrl: origin(onlineServerUrl, 'online server URL', mobile),
    publicWebUrl: origin(publicWebUrl, 'public web URL', mobile),
  };
}

module.exports = { readProjectSettings, serverSettings, developmentSettings, publicRuntimeSettings };
