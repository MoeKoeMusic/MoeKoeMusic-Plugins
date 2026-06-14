// 脚本作用：根据插件 manifest 和快照文件静态识别市场权限标签。
const fs = require('fs');
const path = require('path');

const NATIVE_HOST_PERMISSION = 'moekoe:nativeHost';
const STORAGE_PERMISSION = 'storage';
const MAX_TEXT_FILE_BYTES = 512 * 1024;
const MAX_EVIDENCE_PER_PERMISSION = 12;
const EXECUTABLE_EXTENSIONS = new Set([
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.node',
  '.bin',
  '.app',
  '.wasm',
  '.msi',
  '.dmg',
  '.pkg',
  '.deb',
  '.rpm',
  '.bat',
  '.cmd',
  '.ps1',
  '.sh',
  '.bash',
  '.zsh',
  '.fish',
  '.command',
]);
const IGNORED_DIRECTORIES = new Set([
  '.git',
]);
const TEXT_EXTENSIONS = new Set([
  '.js',
  '.ts',
  '.mjs',
  '.cjs',
  '.jsx',
  '.tsx',
  '.vue',
  '.html',
  '.htm',
  '.css',
  '.scss',
  '.json',
  '.md',
  '.txt',
]);

function analyzePluginPermissions(sourceDir, manifest) {
  const content = manifest?.content && typeof manifest.content === 'object' ? manifest.content : {};
  const declaredPermissions = collectDeclaredPermissions(content);
  const hostPermissions = collectHostPermissions(content);
  const evidence = createEmptyEvidence();
  const permissions = {
    networkAccess: false,
    fileAccess: false,
    binaryContent: false,
    storageAccess: false,
  };

  if (hasNativeHostCapability(content)) {
    addEvidence(evidence, 'binaryContent', 'manifest 声明 moekoe:nativeHost 或 moekoe_native_hosts');
  }

  if (declaredPermissions.has(STORAGE_PERMISSION)) {
    addEvidence(evidence, 'storageAccess', 'manifest 声明 storage');
  }

  if (hostPermissions.some(isNetworkHostPermission) || hasNetworkPermission(declaredPermissions)) {
    addEvidence(evidence, 'networkAccess', 'manifest 声明网络/站点访问权限');
  }

  if (hasFilePermission(declaredPermissions) || hostPermissions.some(isFileHostPermission)) {
    addEvidence(evidence, 'fileAccess', 'manifest 声明文件相关权限');
  }

  if (sourceDir && fs.existsSync(sourceDir)) {
    scanSourceDirectory(sourceDir, evidence);
  }

  for (const key of Object.keys(permissions)) {
    permissions[key] = evidence[key].length > 0;
  }

  return {
    ...permissions,
    evidence,
  };
}

function collectDeclaredPermissions(manifestContent) {
  return new Set([
    ...readStringArray(manifestContent.permissions),
    ...readStringArray(manifestContent.optional_permissions),
    ...readStringArray(manifestContent.moekoe_permissions),
  ]);
}

function collectHostPermissions(manifestContent) {
  return [
    ...readStringArray(manifestContent.host_permissions),
    ...readStringArray(manifestContent.optional_host_permissions),
    ...readStringArray(manifestContent.permissions).filter((value) => value.includes('://') || value === '<all_urls>'),
  ];
}

function readStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => String(item || '').trim()).filter(Boolean);
}

function hasNativeHostDeclarations(manifestContent) {
  return Array.isArray(manifestContent.moekoe_native_hosts) && manifestContent.moekoe_native_hosts.length > 0;
}

function hasNativeHostCapability(manifestContent) {
  const declaredPermissions = collectDeclaredPermissions(manifestContent);
  return declaredPermissions.has(NATIVE_HOST_PERMISSION) || hasNativeHostDeclarations(manifestContent);
}

function hasNetworkPermission(permissions) {
  return ['webRequest', 'declarativeNetRequest', 'proxy'].some((permission) => permissions.has(permission));
}

function hasFilePermission(permissions) {
  return ['downloads', 'fileSystem', 'fileBrowserHandler'].some((permission) => permissions.has(permission));
}

function isNetworkHostPermission(value) {
  return value === '<all_urls>' || /^(https?|\*):\/\//i.test(value);
}

function isFileHostPermission(value) {
  return /^file:\/\//i.test(value);
}

function createEmptyEvidence() {
  return {
    networkAccess: [],
    fileAccess: [],
    binaryContent: [],
    storageAccess: [],
  };
}

function addEvidence(evidence, key, reason) {
  if (evidence[key].length >= MAX_EVIDENCE_PER_PERMISSION) {
    return;
  }

  if (!evidence[key].includes(reason)) {
    evidence[key].push(reason);
  }
}

function scanSourceDirectory(rootDir, evidence) {
  walkDirectory(rootDir, rootDir, evidence);
}

function walkDirectory(rootDir, currentDir, evidence) {
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    const fullPath = path.join(currentDir, entry.name);
    const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      if (path.extname(entry.name).toLowerCase() === '.app') {
        addEvidence(evidence, 'binaryContent', `发现可执行类目录：${relativePath}`);
      }
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }
      walkDirectory(rootDir, fullPath, evidence);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    inspectFile(fullPath, relativePath, evidence);
  }
}

function inspectFile(fullPath, relativePath, evidence) {
  const extension = path.extname(relativePath).toLowerCase();
  const stat = fs.statSync(fullPath);

  if (isExecutableFile(fullPath, extension, stat)) {
    addEvidence(evidence, 'binaryContent', `发现可执行类文件：${relativePath}`);
  }

  if (!TEXT_EXTENSIONS.has(extension) || stat.size > MAX_TEXT_FILE_BYTES) {
    return;
  }

  const buffer = fs.readFileSync(fullPath);
  if (isBinaryBuffer(buffer)) {
    return;
  }

  inspectTextContent(buffer.toString('utf8'), relativePath, evidence);
}

function isExecutableFile(fullPath, extension, stat) {
  if (EXECUTABLE_EXTENSIONS.has(extension)) {
    return true;
  }

  if ((stat.mode & 0o111) !== 0) {
    const firstLine = readFirstLine(fullPath);
    return /^#!\s*\/(?:usr\/bin\/env\s+)?(?:node|python\d*|bash|sh|zsh|fish|ruby|perl|php|deno)\b/i.test(firstLine);
  }

  const header = readFileHeader(fullPath, 4);
  return isExecutableMagic(header);
}

function readFirstLine(fullPath) {
  const buffer = readFileHeader(fullPath, 128);
  return buffer.toString('utf8').split(/\r?\n/, 1)[0] || '';
}

function readFileHeader(fullPath, length) {
  const fd = fs.openSync(fullPath, 'r');
  try {
    const buffer = Buffer.alloc(length);
    const bytesRead = fs.readSync(fd, buffer, 0, length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    fs.closeSync(fd);
  }
}

function isExecutableMagic(buffer) {
  if (buffer.length < 4) {
    return false;
  }

  const firstTwo = buffer.subarray(0, 2).toString('binary');
  if (firstTwo === 'MZ') {
    return true;
  }

  if (buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) {
    return true;
  }

  const magic = buffer.readUInt32BE(0);
  return [0xcafebabe, 0xfeedface, 0xcefaedfe, 0xfeedfacf, 0xcffaedfe].includes(magic);
}

function isBinaryBuffer(buffer) {
  const sample = buffer.subarray(0, Math.min(buffer.length, 512));
  return sample.includes(0);
}

function inspectTextContent(text, relativePath, evidence) {
  const checks = [
    ['networkAccess', /\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\s*\(|\bEventSource\s*\(|\bnavigator\.sendBeacon\s*\(|\baxios\s*\.|\baxios\s*\(|\b(superagent|got|ky)\s*\(|\bhttps?\.request\s*\(|\bhttps?\.get\s*\(|\brequire\s*\(\s*['"](?:node:)?https?['"]\s*\)|\bfrom\s+['"](?:node:)?https?['"]/i, '源码使用网络请求 API'],
    ['fileAccess', /\bchrome\.downloads\b|\bbrowser\.downloads\b|\bshowOpenFilePicker\s*\(|\bshowSaveFilePicker\s*\(|\bFileReader\b|\b<input[^>]+type=["']file["']|\brequire\s*\(\s*['"](?:node:)?fs['"]\s*\)|\bfrom\s+['"](?:node:)?fs['"]|\bfs\.(?:promises\.)?(?:readFile|writeFile|appendFile|createReadStream|createWriteStream|readdir|mkdir|rm|unlink|copyFile|rename)\b/i, '源码使用文件读写相关 API'],
    ['storageAccess', /\bchrome\.storage\b|\bbrowser\.storage\b|\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b|\bIDB(?:Database|ObjectStore|Transaction|Request|KeyRange)\b/i, '源码使用存储相关 API'],
  ];

  for (const [key, pattern, reason] of checks) {
    if (pattern.test(text)) {
      addEvidence(evidence, key, `${reason}：${relativePath}`);
    }
  }
}

module.exports = {
  NATIVE_HOST_PERMISSION,
  STORAGE_PERMISSION,
  analyzePluginPermissions,
  hasNativeHostCapability,
};
