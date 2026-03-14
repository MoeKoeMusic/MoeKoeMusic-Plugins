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
  if (manifest.error) {
    return { error: `${MANIFEST_FILE} 不是有效 JSON：${manifest.error}` };
  }
  if (!manifest.version) {
    return { error: `${MANIFEST_FILE} 缺少 version 字段。` };
  }
  if (!isValidVersion(manifest.version)) {
    return { error: `${MANIFEST_FILE} 中的 version 格式无效：\`${manifest.version}\`。` };
  }

  return {
    type: 'release-asset',
    version: manifest.version,
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
  if (manifest.error) {
    return { error: `${MANIFEST_FILE} 不是有效 JSON：${manifest.error}` };
  }
  if (!manifest.version) {
    return { error: `${MANIFEST_FILE} 缺少 version 字段。` };
  }
  if (!isValidVersion(manifest.version)) {
    return { error: `${MANIFEST_FILE} 中的 version 格式无效：\`${manifest.version}\`。` };
  }

  return {
    type: 'repository-tree',
    version: manifest.version,
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

function isValidVersion(version) {
  return /^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(String(version || '').trim());
}

module.exports = {
  buildRepositoryArchiveUrl,
  buildRepositorySnapshotUrl,
  isValidVersion,
  resolvePublishSnapshot,
};
