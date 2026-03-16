const fs = require('fs');

const MANIFEST_FILE = 'manifest.json';
const FORM_FIELD_TITLES = {
  operationType: '操作类型',
  pluginName: '插件名称',
  pluginId: '插件唯一 ID',
  pluginDescription: '插件描述',
  repositoryUrl: 'GitHub 仓库地址',
  buildRequired: '安装前是否需要编译',
  networkAccess: '是否包含网络请求',
  fileAccess: '是否包含本地文件读写',
  binaryContent: '是否包含可执行二进制',
  extraNotes: '补充说明',
  confirmations: '提交确认',
};

function loadContext() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  const apiUrl = process.env.GITHUB_API_URL || 'https://api.github.com';

  if (!eventPath) {
    throw new Error('缺少 GITHUB_EVENT_PATH。');
  }
  if (!token) {
    throw new Error('缺少 GITHUB_TOKEN。');
  }
  if (!repository) {
    throw new Error('缺少 GITHUB_REPOSITORY。');
  }

  return {
    payload: JSON.parse(fs.readFileSync(eventPath, 'utf8')),
    token,
    apiUrl,
    repository,
  };
}

function isPublishIssue(payload) {
  const issue = payload.issue;
  if (!issue) {
    return false;
  }

  if (payload.action === 'labeled' && payload.label?.name !== 'publish') {
    return false;
  }

  const labelNames = (issue.labels || []).map((label) => label.name);
  return labelNames.includes('publish') || (issue.title || '').startsWith('[Plugin]:');
}

function isModerationIssue(payload) {
  const issue = payload.issue;
  if (!issue) {
    return false;
  }

  if (payload.action === 'labeled' && payload.label?.name !== 'moderation') {
    return false;
  }

  const labelNames = (issue.labels || []).map((label) => label.name);
  return labelNames.includes('moderation') || (issue.title || '').startsWith('[Plugin Review]:');
}

function parseIssueForm(body) {
  const sections = parseIssueSections(body);

  return Object.fromEntries(
    Object.entries(FORM_FIELD_TITLES).map(([key, title]) => [key, normalizeFieldValue(sections[title])])
  );
}

function parseIssueSections(body) {
  const normalized = String(body || '').replace(/\r\n/g, '\n').trim();
  const sections = {};
  const headings = [...normalized.matchAll(/^###\s+(.+)$/gm)];

  for (let index = 0; index < headings.length; index += 1) {
    const current = headings[index];
    const next = headings[index + 1];
    const title = current[1].trim();
    const contentStart = current.index + current[0].length;
    const contentEnd = next ? next.index : normalized.length;
    sections[title] = normalized.slice(contentStart, contentEnd).trim();
  }

  return sections;
}

function normalizeFieldValue(value) {
  const trimmed = String(value || '').trim();
  return trimmed === '_No response_' ? '' : trimmed;
}

function parseRepositoryReference(repositoryUrl) {
  try {
    const parsed = new URL(repositoryUrl);
    if (parsed.hostname !== 'github.com') {
      return null;
    }

    const parts = parsed.pathname.replace(/^\/+|\/+$/g, '').split('/');
    if (parts.length < 2) {
      return null;
    }

    return {
      owner: parts[0],
      repo: parts[1].replace(/\.git$/i, ''),
    };
  } catch {
    return null;
  }
}

async function fetchRepository(context, repositoryRef, options = {}) {
  const response = await githubRequest(
    context,
    `/repos/${encodeURIComponent(repositoryRef.owner)}/${encodeURIComponent(repositoryRef.repo)}`,
    options
  );

  if (response.status === 404) {
    return null;
  }

  return response.data;
}

async function fetchBranch(context, repositoryRef, branch, options = {}) {
  const response = await githubRequest(
    context,
    `/repos/${encodeURIComponent(repositoryRef.owner)}/${encodeURIComponent(repositoryRef.repo)}/branches/${encodeURIComponent(branch)}`,
    options
  );

  if (response.status === 404) {
    return null;
  }

  return response.data;
}

async function fetchLatestRelease(context, repositoryRef) {
  const response = await githubRequest(
    context,
    `/repos/${encodeURIComponent(repositoryRef.owner)}/${encodeURIComponent(repositoryRef.repo)}/releases?per_page=5`
  );
  const releases = Array.isArray(response.data) ? response.data : [];
  return releases.find((release) => !release.draft && !release.prerelease) || releases[0] || null;
}

async function fetchLatestTag(context, repositoryRef) {
  const response = await githubRequest(
    context,
    `/repos/${encodeURIComponent(repositoryRef.owner)}/${encodeURIComponent(repositoryRef.repo)}/tags?per_page=1`
  );
  const tags = Array.isArray(response.data) ? response.data : [];
  return tags[0] || null;
}

async function fetchManifest(context, repositoryRef, branch, options = {}) {
  const response = await githubRequest(
    context,
    `/repos/${encodeURIComponent(repositoryRef.owner)}/${encodeURIComponent(repositoryRef.repo)}/contents/${MANIFEST_FILE}?ref=${encodeURIComponent(branch)}`,
    { allow404: options.allow404 }
  );

  if (response.status === 404 || !response.data?.content) {
    return null;
  }

  try {
    const content = JSON.parse(Buffer.from(response.data.content, 'base64').toString('utf8'));
    return {
      path: MANIFEST_FILE,
      content,
      pluginId: typeof content.plugin_id === 'string' ? content.plugin_id.trim() : '',
      version: typeof content.version === 'string' ? content.version.trim() : '',
      error: null,
    };
  } catch (error) {
    return {
      path: MANIFEST_FILE,
      content: null,
      pluginId: '',
      version: '',
      error: error.message,
    };
  }
}

function isYesOption(value) {
  return String(value || '').trim().startsWith('是');
}

function parseChineseBoolean(value) {
  const normalized = String(value || '').trim();
  if (normalized === '是') {
    return true;
  }
  if (normalized === '否') {
    return false;
  }
  return null;
}

async function githubRequest(context, apiPath, options = {}) {
  const method = options.method || 'GET';
  const url = `${context.apiUrl}${apiPath}`;
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${context.token}`,
    'User-Agent': 'moekoemusic-plugin-workflows',
  };

  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (options.allow404 && response.status === 404) {
    return { status: 404, data: null };
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub API 请求失败：${method} ${apiPath} -> ${response.status} ${errorText}`);
  }

  if (response.status === 204) {
    return { status: 204, data: null };
  }

  return {
    status: response.status,
    data: await response.json(),
  };
}

module.exports = {
  FORM_FIELD_TITLES,
  MANIFEST_FILE,
  fetchLatestRelease,
  fetchLatestTag,
  fetchBranch,
  fetchManifest,
  fetchRepository,
  githubRequest,
  isModerationIssue,
  isPublishIssue,
  isYesOption,
  loadContext,
  parseChineseBoolean,
  parseIssueForm,
  parseIssueSections,
  parseRepositoryReference,
};
