const fs = require('fs');

const {
  fetchRepository,
  githubRequest,
  isPublishIssue,
  isYesOption,
  loadContext,
  parseIssueForm,
  parseRepositoryReference,
} = require('./lib/publish-plugin-common');
const { findPluginById } = require('./lib/plugin-registry');
const { resolvePublishSnapshot } = require('./lib/publish-snapshot');

const COMMENT_MARKER = '<!-- plugin-publish-validation -->';
const SNAPSHOT_MARKER_PREFIX = '<!-- plugin-publish-snapshot:';
const SNAPSHOT_MARKER_SUFFIX = ' -->';
const STATUS_LABELS = ['check-passed', 'check-failed'];
const REQUIRED_FIELDS = [
  ['操作类型', 'operationType'],
  ['插件名称', 'pluginName'],
  ['插件描述', 'pluginDescription'],
  ['GitHub 仓库地址', 'repositoryUrl'],
  ['安装前是否需要编译', 'buildRequired'],
  ['是否包含网络请求', 'networkAccess'],
  ['是否包含本地文件读写', 'fileAccess'],
  ['是否包含可执行二进制', 'binaryContent'],
  ['提交确认', 'confirmations'],
];

async function main() {
  const context = loadContext();
  const issue = context.payload.issue;

  if (!issue) {
    throw new Error('当前事件不包含 issue 数据。');
  }

  if (!isPublishIssue(context.payload)) {
    console.log('当前 issue 不是插件提交请求，跳过处理。');
    return;
  }

  const formData = parseIssueForm(issue.body || '');
  const result = createResult(issue, formData);

  validateFormFields(formData, result);

  if (result.failures.length === 0) {
    await validateOperation(context, issue, formData, result);
  }

  result.status = result.failures.length > 0 ? 'check-failed' : 'check-passed';

  await upsertValidationComment(context, issue.number, buildCommentBody(result));
  await syncStatusLabels(context, issue, result.status);
  await writeStepSummary(result);

  console.log(`插件提交审查完成，状态：${result.status}`);
}

function createResult(issue, formData) {
  return {
    status: 'check-passed',
    failures: [],
    notices: [],
    snapshot: null,
    payload: {
      schema: 'publish-validation-v1',
      status: 'check-failed',
      issueNumber: issue.number,
      issueAuthor: issue.user?.login || null,
      operationType: formData.operationType || '',
      plugin: {
        id: '',
        name: formData.pluginName || '',
        description: formData.pluginDescription || '',
        repositoryUrl: formData.repositoryUrl || '',
        buildRequired: isYesOption(formData.buildRequired),
        networkAccess: toBoolean(formData.networkAccess),
        fileAccess: toBoolean(formData.fileAccess),
        binaryContent: toBoolean(formData.binaryContent),
      },
      snapshot: null,
    },
  };
}

function validateFormFields(formData, result) {
  for (const [label, key] of REQUIRED_FIELDS) {
    if (!formData[key]) {
      result.failures.push(`缺少必填字段：${label}。`);
    }
  }

  if (!['新上架', '更新插件'].includes(formData.operationType)) {
    result.failures.push('操作类型无效，只允许“新上架”或“更新插件”。');
  }

  if (formData.pluginDescription && formData.pluginDescription.length < 10) {
    result.failures.push('插件描述过短，请至少提供更清晰的功能说明。');
  }

  const confirmationCount = (formData.confirmations.match(/- \[x\]/gi) || []).length;
  if (confirmationCount < 2) {
    result.failures.push('提交确认项不完整，请重新勾选全部确认项。');
  }
}

async function validateOperation(context, issue, formData, result) {
  const repositoryRef = parseRepositoryReference(formData.repositoryUrl);

  if (!repositoryRef) {
    result.failures.push('GitHub 仓库地址格式无效，必须是 `https://github.com/owner/repo`。');
    return;
  }

  const repository = await fetchRepository(context, repositoryRef, { allow404: true });
  if (!repository) {
    result.failures.push('目标 GitHub 仓库不存在，或当前令牌无法访问该仓库。');
    return;
  }
  if (repository.private) {
    result.failures.push('目标 GitHub 仓库是私有仓库，无法用于公开插件市场。');
    return;
  }
  if (repository.archived) {
    result.notices.push('目标 GitHub 仓库已归档，请人工确认是否仍允许提交。');
  }

  const snapshot = await resolvePublishSnapshot(context, repositoryRef, repository, isYesOption(formData.buildRequired));

  if (snapshot.error) {
    result.failures.push(snapshot.error);
    return;
  }

  result.snapshot = snapshot;
  result.payload.plugin.id = snapshot.pluginId;
  result.payload.snapshot = snapshot;

  const existingPlugin = findPluginById(snapshot.pluginId);
  if (formData.operationType === '新上架' && existingPlugin) {
    result.failures.push(`插件 ID \`${snapshot.pluginId}\` 已存在，不能重复新上架。`);
    return;
  }

  if (formData.operationType === '更新插件') {
    validateUpdatePermission(existingPlugin, snapshot.pluginId, formData, issue, result);
    if (result.failures.length > 0) {
      return;
    }
  }

  if (formData.operationType === '更新插件' && existingPlugin?.version === snapshot.version) {
    result.failures.push(`更新插件时版本号不能与当前已上架版本相同：\`${snapshot.version}\`。`);
    return;
  }

  result.payload.status = 'check-passed';
}

function validateUpdatePermission(existingPlugin, pluginId, formData, issue, result) {
  if (!existingPlugin) {
    result.failures.push(`插件 ID \`${pluginId}\` 不存在，无法更新。`);
    return;
  }

  const issueAuthor = issue.user?.login || '';
  if (!existingPlugin.author) {
    result.failures.push('当前插件记录缺少 author，无法校验更新提交人身份。');
    return;
  }

  if (existingPlugin.author !== issueAuthor) {
    result.failures.push(
      `更新插件需要作者本人提交。当前记录作者是 \`${existingPlugin.author}\`，本次提交用户是 \`${issueAuthor || '未知'}\`。`
    );
  }

  if (existingPlugin.repositoryUrl && existingPlugin.repositoryUrl !== formData.repositoryUrl) {
    result.failures.push('更新插件时仓库地址必须与当前记录一致。');
  }
}

function toBoolean(value) {
  if (value === '是') {
    return true;
  }
  if (value === '否') {
    return false;
  }
  return null;
}

function buildCommentBody(result) {
  const lines = [
    COMMENT_MARKER,
    '## 插件提交自动校验结果',
    '',
    `- 当前状态：\`${result.status}\``,
    `- 操作类型：${result.payload.operationType || '未解析到'}`,
    `- 插件名称：${result.payload.plugin.name || '未解析到'}`,
    `- 插件 ID：${result.payload.plugin.id || '未解析到'}`,
    `- 仓库地址：${result.payload.plugin.repositoryUrl || '未解析到'}`,
    `- 快照地址：${result.snapshot?.snapshotUrl || result.snapshot?.downloadUrl || '未锁定快照'}`,
    '',
  ];

  appendSection(lines, '校验失败项', result.failures);
  appendSection(lines, '提示信息', result.notices);
  appendSection(lines, '锁定快照', buildSnapshotFacts(result.snapshot));

  lines.push(buildHiddenSnapshotPayload(result.payload));

  return lines.join('\n');
}

function buildHiddenSnapshotPayload(payload) {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
  return `${SNAPSHOT_MARKER_PREFIX}${encoded}${SNAPSHOT_MARKER_SUFFIX}`;
}

function buildSnapshotFacts(snapshot) {
  if (!snapshot) {
    return [];
  }

  const facts = [
    `版本：${snapshot.version}`,
    `快照地址：${snapshot.downloadUrl}`,
  ];

  if (snapshot.type === 'release-asset') {
    facts.push(`审核 tag：${snapshot.release.tag}`);
    facts.push(`发行附件：${snapshot.release.assetName || '-'}`);
  }

  if (snapshot.type === 'repository-tree') {
    facts.push(`审核分支：${snapshot.branch}`);
    facts.push(`审核 commit：${snapshot.commitSha}`);
  }

  return facts;
}

function appendSection(lines, title, items) {
  lines.push(`### ${title}`);
  if (!items.length) {
    lines.push('- 无', '');
    return;
  }

  for (const item of items) {
    lines.push(`- ${item}`);
  }
  lines.push('');
}

async function upsertValidationComment(context, issueNumber, body) {
  const [owner, repo] = context.repository.split('/');
  const commentsResponse = await githubRequest(
    context,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}/comments?per_page=100`
  );
  const comments = Array.isArray(commentsResponse.data) ? commentsResponse.data : [];
  const existingComment = comments.find((comment) => comment.body?.includes(COMMENT_MARKER));

  const apiPath = existingComment
    ? `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/comments/${existingComment.id}`
    : `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}/comments`;

  await githubRequest(context, apiPath, {
    method: existingComment ? 'PATCH' : 'POST',
    body: { body },
  });
}

async function syncStatusLabels(context, issue, nextStatus) {
  const [owner, repo] = context.repository.split('/');
  const labels = (issue.labels || []).map((label) => label.name).filter((label) => !STATUS_LABELS.includes(label));
  labels.push(nextStatus);

  await githubRequest(context, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issue.number}`, {
    method: 'PATCH',
    body: { labels },
  });
}

async function writeStepSummary(result) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) {
    return;
  }

  const lines = [
    '# 插件提交自动校验',
    '',
    `- 状态：\`${result.status}\``,
    `- 操作类型：${result.payload.operationType || '未解析到'}`,
    `- 插件 ID：${result.payload.plugin.id || '未解析到'}`,
    '',
  ];

  appendSection(lines, '校验失败项', result.failures);
  appendSection(lines, '提示信息', result.notices);
  appendSection(lines, '锁定快照', buildSnapshotFacts(result.snapshot));

  fs.appendFileSync(summaryPath, `${lines.join('\n')}\n`, 'utf8');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
