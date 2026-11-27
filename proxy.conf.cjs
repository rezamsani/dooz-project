const { developmentSettings, readProjectSettings } = require('./src/project-settings.cjs');

const { onlinePort } = developmentSettings(readProjectSettings(__dirname));
const target = `http://127.0.0.1:${onlinePort}`;

module.exports = {
  '/api/ws': { target, ws: true, changeOrigin: true },
  '/api/health': { target, changeOrigin: true },
  '/runtime-config.json': { target, changeOrigin: true },
};
