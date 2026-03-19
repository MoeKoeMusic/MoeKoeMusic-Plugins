// 脚本作用：解析并校验仓库 manifest，生成用于发布入库的快照信息。
const {
  MANIFEST_FILE,
  fetchBranch,
  fetchLatestRelease,
  fetchManifest,
} = require('./publish-plugin-common');

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

  const manifest = await fetchManifest(context, repositoryRef, release.tag_name, { allow404: true });
  if (!manifest) {
    return { error: `仓库在 tag \`${release.tag_name}\` 中未找到 ${MANIFEST_FILE}。` };
  }
  const manifestError = validateManifest(manifest);
  if (manifestError) {
    return { error: manifestError };
  }

  return {
    type: 'release-asset',
    pluginId: manifest.pluginId,
    iconPath: manifest.iconPath,
    iconUrl: buildRawGitHubContentUrl(repository.full_name, release.tag_name, manifest.iconPath),
    version: manifest.version,
    minversion: manifest.minversion,
    repository: repository.full_name,
    repositoryUrl: repository.html_url,
    reviewRef: release.tag_name,
    snapshotUrl: buildRepositorySnapshotUrl(repository.full_name, release.tag_name),
    downloadUrl: asset.browser_download_url,
    release: {
      tag: release.tag_name,
      name: release.name || release.tag_name,
      publishedAt: release.published_at || release.created_at || '',
      assetName: asset.name || '',
      assetSize: asset.size || 0,
      downloadUrl: asset.browser_download_url,
    },
  };
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

  return {
    type: 'repository-tree',
    pluginId: manifest.pluginId,
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
    downloadUrl: buildRepositorySnapshotUrl(repository.full_name, branch.commit.sha),
    release: null,
  };
}

function buildRepositorySnapshotUrl(repositoryFullName, ref) {
  return `https://github.com/${repositoryFullName}/tree/${ref}`;
}

function buildRepositoryArchiveUrl(repositoryFullName, ref) {
  return `https://codeload.github.com/${repositoryFullName}/zip/${ref}`;
}

function buildRawGitHubContentUrl(repositoryFullName, ref, filePath) {
  const normalizedPath = String(filePath || '').trim().replace(/^\/+/, '');
  if (!normalizedPath) {
    return '';
  }

  return `https://raw.githubusercontent.com/${repositoryFullName}/${ref}/${normalizedPath}`;
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

  return '';
}

function isValidPluginId(pluginId) {
  return /^[a-z0-9]+(?:[._-][a-z0-9]+)+$/i.test(String(pluginId || '').trim());
}

function isValidVersion(version) {
  return /^\d+\.\d+\.\d+$/.test(String(version || '').trim());
}

module.exports = {
  buildRepositoryArchiveUrl,
  buildRepositorySnapshotUrl,
  isValidVersion,
  resolvePublishSnapshot,
};
