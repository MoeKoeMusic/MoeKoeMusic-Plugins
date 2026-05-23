// 脚本作用：下载并解压插件快照产物，供校验和审核流程读取内容。
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const { MANIFEST_FILE, parseManifestText } = require('./publish-plugin-common');

const execFileAsync = promisify(execFile);

async function prepareArchiveWorkspace(archiveUrl, options = {}) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-snapshot-'));
  const extractDir = path.join(rootDir, 'source');
  fs.mkdirSync(extractDir, { recursive: true });

  const archivePath = path.join(rootDir, resolveArchiveFileName(archiveUrl, options.assetName));
  const response = await fetch(archiveUrl);
  if (!response.ok) {
    throw new Error(`下载插件产物失败：${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(archivePath, buffer);

  await extractArchive(archivePath, extractDir);

  return {
    rootDir,
    archivePath,
    sourceDir: resolveExtractedSourceDir(extractDir),
  };
}

function resolveArchiveFileName(archiveUrl, assetName) {
  if (assetName) {
    return assetName;
  }

  try {
    const parsed = new URL(archiveUrl);
    const name = parsed.pathname.split('/').pop();
    if (name) {
      return name;
    }
  } catch {}

  return 'snapshot.zip';
}

async function extractArchive(archivePath, extractDir) {
  const lower = archivePath.toLowerCase();

  if (lower.endsWith('.zip')) {
    await execFileAsync('unzip', ['-q', archivePath, '-d', extractDir]);
    return;
  }

  if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) {
    await execFileAsync('tar', ['-xzf', archivePath, '-C', extractDir]);
    return;
  }

  if (lower.endsWith('.tar')) {
    await execFileAsync('tar', ['-xf', archivePath, '-C', extractDir]);
    return;
  }

  throw new Error(`不支持的发行产物格式：${path.basename(archivePath)}`);
}

function resolveExtractedSourceDir(extractDir) {
  const extractedEntries = fs.readdirSync(extractDir, { withFileTypes: true });
  const directories = extractedEntries.filter((entry) => entry.isDirectory());
  const files = extractedEntries.filter((entry) => entry.isFile());

  if (directories.length === 1 && files.length === 0) {
    return path.join(extractDir, directories[0].name);
  }

  return extractDir;
}

function readManifestFromDirectory(sourceDir) {
  const manifestPath = path.join(sourceDir, MANIFEST_FILE);
  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  return parseManifestText(fs.readFileSync(manifestPath, 'utf8'), MANIFEST_FILE);
}

function cleanupDirectory(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

module.exports = {
  cleanupDirectory,
  prepareArchiveWorkspace,
  readManifestFromDirectory,
};
