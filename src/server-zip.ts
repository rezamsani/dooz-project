import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { deflateRawSync } from 'node:zlib';

const ALLOWED_ROOT_FILES = new Set([
  'package.json',
  'package-lock.json',
  'angular.json',
  'tsconfig.json',
  'tsconfig.app.json',
  'tsconfig.spec.json',
  'tsconfig.online.json',
  'proxy.conf.cjs',
  'appsettings.example.json',
  'README.md',
  'capacitor.config.ts',
  'eslint.config.js',
  '.postcssrc.json',
  '.gitignore',
  'metadata.json',
]);

const ALLOWED_DIRS = ['src', 'public', 'scripts'] as const;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
  name: string;
  data: Buffer;
}

function buildZipBuffer(entries: readonly ZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  // Fixed valid DOS date/time (2026-01-01 00:00:00)
  const dosTime = 0x0000;
  const dosDate = 0x5c21;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const uncompressed = entry.data;
    const compressed = deflateRawSync(uncompressed, { level: 6 });
    const crc = crc32(uncompressed);

    // Local File Header (30 bytes + filename)
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0x0800, 6); // UTF-8 filename flag
    localHeader.writeUInt16LE(8, 8); // DEFLATE compression
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(uncompressed.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuf, compressed);

    // Central Directory Header (46 bytes + filename)
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(0x0800, 8); // UTF-8 flag
    centralHeader.writeUInt16LE(8, 10); // DEFLATE
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(uncompressed.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuf);

    offset += localHeader.length + nameBuf.length + compressed.length;
  }

  const centralDirSize = centralParts.reduce((sum, part) => sum + part.length, 0);

  // End of Central Directory Record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirSize, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, eocd]);
}

function collectSafeFiles(projectRoot: string, currentDir: string, out: ZipEntry[]): void {
  const entries = readdirSync(currentDir, { withFileTypes: true });
  for (const item of entries) {
    // Skip hidden environment/vcs files and build/dependency folders
    if (
      item.name === 'node_modules' ||
      item.name === '.git' ||
      item.name === 'dist' ||
      item.name === '.angular' ||
      item.name === 'appsettings.json' ||
      item.name.startsWith('.env')
    ) {
      continue;
    }

    const fullPath = resolve(currentDir, item.name);
    if (!fullPath.startsWith(projectRoot + sep)) {
      continue;
    }

    const stat = lstatSync(fullPath);
    if (stat.isSymbolicLink()) {
      continue;
    }

    if (stat.isDirectory()) {
      collectSafeFiles(projectRoot, fullPath, out);
    } else if (stat.isFile()) {
      const relPosix = relative(projectRoot, fullPath).split(sep).join('/');
      out.push({
        name: `dooz-project/${relPosix}`,
        data: readFileSync(fullPath),
      });
    }
  }
}

const PERSIAN_README = `# بازی دوز (Dooz)

پروژه کامل بازی فکری دوز با Angular و Tailwind CSS شامل نسخه‌های دوز ۳ تایی (کلاسیک و بی‌نهایت)، دوز ۹ تایی و دوز ۱۲ تایی با هوش مصنوعی سه‌سطحی و حالت دونفره محلی.

## پیش‌نیازها
- نصب بودن Node.js (نسخه ۲۰ به بالا)

## روش اجرا روی سیستم شما
1. فایل ZIP را از حالت فشرده خارج کنید.
2. ترمینال (Command Prompt / PowerShell / Terminal) را در پوشه پروژه باز کنید.
3. دستورهای زیر را اجرا کنید:

\`\`\`bash
npm install
npm start
\`\`\`

4. مرورگر را روی آدرس \`http://localhost:3000\` باز کنید.
`;

export function createProjectZipArchive(): Buffer | null {
  const projectRoot = resolve(process.cwd());
  const pkgPath = resolve(projectRoot, 'package.json');
  if (!existsSync(pkgPath)) {
    return null;
  }

  const zipEntries: ZipEntry[] = [];

  for (const fileName of ALLOWED_ROOT_FILES) {
    const filePath = resolve(projectRoot, fileName);
    if (!filePath.startsWith(projectRoot + sep) || !existsSync(filePath)) {
      continue;
    }
    const stat = lstatSync(filePath);
    if (stat.isFile() && !stat.isSymbolicLink()) {
      zipEntries.push({
        name: `dooz-project/${fileName}`,
        data: readFileSync(filePath),
      });
    }
  }

  for (const dirName of ALLOWED_DIRS) {
    const dirPath = resolve(projectRoot, dirName);
    if (!dirPath.startsWith(projectRoot + sep) || !existsSync(dirPath)) {
      continue;
    }
    const stat = lstatSync(dirPath);
    if (stat.isDirectory() && !stat.isSymbolicLink()) {
      collectSafeFiles(projectRoot, dirPath, zipEntries);
    }
  }

  if (!zipEntries.some((entry) => entry.name === 'dooz-project/README.md')) {
    zipEntries.push({
      name: 'dooz-project/README.md',
      data: Buffer.from(PERSIAN_README, 'utf8'),
    });
  }

  zipEntries.sort((a, b) => a.name.localeCompare(b.name));
  return buildZipBuffer(zipEntries);
}
