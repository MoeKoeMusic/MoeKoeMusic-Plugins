// 脚本作用：解析并校验插件快照，生成用于发布入库的快照信息。
const {
  MANIFEST_FILE,
  fetchBranch,
  fetchLatestRelease,
  fetchManifest,
} = require('./publish-plugin-common');
const {
  NATIVE_HOST_PERMISSION,
  analyzePluginPermissions,
  hasNativeHostCapability,
} = require('./plugin-permissions');
const { cleanupDirectory, prepareArchiveWorkspace, readManifestFromDirectory } = require('./snapshot-archive');

const MIN_NATIVE_HOST_MOEKOE_VERSION = '1.6.6';

async function resolvePublishSnapshot(context, repositoryRef, repository, requiresBuild) {
  return requiresBuild
    ? buildReleaseSnapshot(context, repositoryRef, repository)
    : buildRepositorySnapshot(context, repositoryRef, repository);
}

async function buildReleaseSnapshot(context, repositoryRef, repository) {
  const release = await fetchLatestRelease(context, repositoryRef);
  if (!release?.tag_name) {
    return { error: '该插件需要编译，但当前未找到可用的 Release tag。' };
  }

  const asset = Array.isArray(release.assets) ? release.assets[0] : null;
  if (!asset?.browser_download_url) {
    return { error: '该插件需要编译，但当前 Release 没有可下载附件。' };
  }

  const workspace = await prepareArchiveWorkspace(asset.browser_download_url, { assetName: asset.name || '' });
  try {
    const manifest = readManifestFromDirectory(workspace.sourceDir);
    if (!manifest) {
      return { error: `发行附件中未找到 ${MANIFEST_FILE}。` };
    }

    const manifestError = validateManifest(manifest);
    if (manifestError) {
      return { error: manifestError };
    }

    const iconPath = prependPublicPath(manifest.iconPath);
    const permissions = analyzePluginPermissions(workspace.sourceDir, manifest);

    return {
      type: 'release-asset',
      pluginId: manifest.pluginId,
      pluginName: manifest.name,
      pluginDescription: manifest.description,
      iconPath,
      iconUrl: buildRawGitHubContentUrl(repository.full_name, release.tag_name, iconPath),
      version: manifest.version,
      minversion: manifest.minversion,
      repository: repository.full_name,
      repositoryUrl: repository.html_url,
      reviewRef: release.tag_name,
      snapshotUrl: buildRepositorySnapshotUrl(repository.full_name, release.tag_name),
      downloadUrl: asset.browser_download_url,
      permissions,
      release: {
        tag: release.tag_name,
        name: release.name || release.tag_name,
        publishedAt: release.published_at || release.created_at || '',
        assetName: asset.name || '',
        assetSize: asset.size || 0,
        downloadUrl: asset.browser_download_url,
      },
    };
  } finally {
    cleanupDirectory(workspace.rootDir);
  }
}

async function buildRepositorySnapshot(context, repositoryRef, repository) {
  const branch = await fetchBranch(context, repositoryRef, repository.default_branch, { allow404: true });
  if (!branch?.commit?.sha) {
    return { error: '无法获取仓库默认分支当前快照信息。' };
  }

  const manifest = await fetchManifest(context, repositoryRef, branch.commit.sha, { allow404: true });
  if (!manifest) {
    return { error: `仓库当前快照中未找到 ${MANIFEST_FILE}。` };
  }

  const manifestError = validateManifest(manifest);
  if (manifestError) {
    return { error: manifestError };
  }

  const archiveUrl = buildRepositoryArchiveUrl(repository.full_name, branch.commit.sha);
  const workspace = await prepareArchiveWorkspace(archiveUrl);
  try {
    const permissions = analyzePluginPermissions(workspace.sourceDir, manifest);

    return {
      type: 'repository-tree',
      pluginId: manifest.pluginId,
      pluginName: manifest.name,
      pluginDescription: manifest.description,
      iconPath: manifest.iconPath,
      iconUrl: buildRawGitHubContentUrl(repository.full_name, branch.commit.sha, manifest.iconPath),
      version: manifest.version,
      minversion: manifest.minversion,
      repository: repository.full_name,
      repositoryUrl: repository.html_url,
      reviewRef: branch.commit.sha,
      snapshotUrl: buildRepositorySnapshotUrl(repository.full_name, branch.commit.sha),
      branch: repository.default_branch,
      commitSha: branch.commit.sha,
      downloadUrl: archiveUrl,
      permissions,
      release: null,
    };
  } finally {
    cleanupDirectory(workspace.rootDir);
  }
}

function buildRepositorySnapshotUrl(repositoryFullName, ref) {
  return `https://github.com/${repositoryFullName}/tree/${ref}`;
}

function buildRepositoryArchiveUrl(repositoryFullName, ref) {
  return `https://github.com/${repositoryFullName}/archive/${ref}.zip`;
}

function buildRawGitHubContentUrl(repositoryFullName, ref, filePath) {
  const normalizedPath = normalizePath(filePath);
  if (!normalizedPath) {
    return '';
  }

  return `https://raw.githubusercontent.com/${repositoryFullName}/${ref}/${normalizedPath}`;
}

function prependPublicPath(filePath) {
  const normalizedPath = normalizePath(filePath);
  if (!normalizedPath) {
    return '';
  }

  return normalizedPath.startsWith('public/') ? normalizedPath : `public/${normalizedPath}`;
}

function normalizePath(filePath) {
  return String(filePath || '').trim().replace(/^\.\/+/, '').replace(/^\/+/, '');
}

function validateManifest(manifest) {
  if (manifest.error) {
    return `${MANIFEST_FILE} 不是有效 JSON：${manifest.error}`;
  }
  if (!manifest.pluginId) {
    return `${MANIFEST_FILE} 缺少 plugin_id 字段。`;
  }
  if (!isValidPluginId(manifest.pluginId)) {
    return `${MANIFEST_FILE} 中的 plugin_id 格式无效：\`${manifest.pluginId}\`。`;
  }
  if (!manifest.name) {
    return `${MANIFEST_FILE} 缺少 name 字段。`;
  }
  if (!manifest.description) {
    return `${MANIFEST_FILE} 缺少 description 字段。`;
  }
  if (manifest.description.length < 5) {
    return `${MANIFEST_FILE} 中的 description 过短，请至少提供更清晰真实的功能说明。`;
  }
  if (!manifest.version) {
    return `${MANIFEST_FILE} 缺少 version 字段。`;
  }
  if (!isValidVersion(manifest.version)) {
    return `${MANIFEST_FILE} 中的 version 格式无效：\`${manifest.version}\`。`;
  }
  if (manifest.minversionInvalidType) {
    return `${MANIFEST_FILE} 中的 minversion 必须是字符串。`;
  }
  if (manifest.minversion && !isValidVersion(manifest.minversion)) {
    return `${MANIFEST_FILE} 中的 minversion 格式无效：\`${manifest.minversion}\`。`;
  }

  const capabilityErrors = [
    validateMoekoeManifest(manifest),
    validateNativeHostManifest(manifest),
  ].filter(Boolean);
  if (capabilityErrors.length > 0) {
    return capabilityErrors.join(' ');
  }

  return '';
}

function isValidPluginId(pluginId) {
  return /^[a-z0-9]+(?:[._-][a-z0-9]+)+$/i.test(String(pluginId || '').trim());
}

function isValidVersion(version) {
  return /^\d+\.\d+\.\d+$/.test(String(version || '').trim());
}

function validateMoekoeManifest(manifest) {
  const content = manifest?.content && typeof manifest.content === 'object' ? manifest.content : {};
  return content.moekoe === true ? '' : `${MANIFEST_FILE} 中的 \`moekoe\` 字段必须为 \`true\`。`;
}

function validateNativeHostManifest(manifest) {
  const content = manifest?.content && typeof manifest.content === 'object' ? manifest.content : {};
  if (!hasNativeHostCapability(content)) {
    return '';
  }

  if (!manifest.minversion || compareVersions(manifest.minversion, MIN_NATIVE_HOST_MOEKOE_VERSION) < 0) {
    return `${MANIFEST_FILE} 使用 \`${NATIVE_HOST_PERMISSION}\` 时，\`minversion\` 必须大于或等于 \`${MIN_NATIVE_HOST_MOEKOE_VERSION}\`。`;
  }

  return '';
}

function compareVersions(left, right) {
  const leftParts = String(left || '').split('.').map(Number);
  const rightParts = String(right || '').split('.').map(Number);

  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
}

module.exports = {
  buildRepositoryArchiveUrl,
  buildRepositorySnapshotUrl,
  isValidVersion,
  resolvePublishSnapshot,
};
