const fs = require('fs');

const {
  githubRequest,
  isModerationIssue,
  loadContext,
  parseIssueSections,
} = require('./lib/publish-plugin-common');
const { findPluginById } = require('./lib/plugin-registry');

const COMMENT_MARKER = '<!-- plugin-moderation-validation -->';
const STATUS_LABELS = ['check-passed', 'check-failed'];
const FIELD_TITLES = {
  requestType: '处理类型',
  pluginName: '插件名称',
  pluginId: '插件唯一 ID',
  repositoryUrl: '插件仓库或市场页面链接',
  requestReason: '原因分类',
  issueDescription: '详细说明',
  confirmations: '提交确认',
};

async function main() {
  const context = loadContext();
  const issue = context.payload.issue;

  if (!issue) {
    throw new Error('当前事件不包含 issue 数据。');
  }

  if (!isModerationIssue(context.payload)) {
    console.log('当前 issue 不是插件处理请求，跳过处理。');
    return;
  }

  const formData = parseModerationForm(issue.body || '');
  const result = {
    status: 'check-passed',
    failures: [],
    notices: [],
    extracted: formData,
    plugin: null,
  };

  validateRequiredFields(formData, result);

  const plugin = findPluginById(formData.pluginId);
  if (!plugin) {
    result.failures.push(`未在 \`plugins.json\` 中找到插件 ID 为 \`${formData.pluginId || '未填写'}\` 的记录。`);
  } else {
    result.plugin = plugin;
    validatePluginMatch(plugin, formData, issue, result);
  }

  result.status = result.failures.length > 0 ? 'check-failed' : 'check-passed';

  await upsertValidationComment(context, issue.number, buildCommentBody(issue, result));
  await syncStatusLabels(context, issue, result.status);
  await writeStepSummary(result);

  console.log(`插件处理审查完成，状态：${result.status}`);
}

function parseModerationForm(body) {
  const sections = parseIssueSections(body);
  return Object.fromEntries(
    Object.entries(FIELD_TITLES).map(([key, title]) => [key, normalizeFieldValue(sections[title])])
  );
}

function normalizeFieldValue(value) {
  const trimmed = String(value || '').trim();
  return trimmed === '_No response_' ? '' : trimmed;
}

function validateRequiredFields(formData, result) {
  for (const [key, title] of Object.entries(FIELD_TITLES)) {
    if (!formData[key]) {
      result.failures.push(`缺少必填字段：${title}。`);
    }
  }

  const confirmationCount = (formData.confirmations.match(/- \[x\]/gi) || []).length;
  if (confirmationCount < 1) {
    result.failures.push('提交确认项不完整，请重新勾选确认项。');
  }
}

function validatePluginMatch(plugin, formData, issue, result) {
  if (formData.pluginName && plugin.name && plugin.name !== formData.pluginName) {
    result.notices.push(`Issue 中的插件名称是 \`${formData.pluginName}\`，索引中的名称是 \`${plugin.name}\`。`);
  }

  if (formData.repositoryUrl && plugin.repositoryUrl && plugin.repositoryUrl !== formData.repositoryUrl) {
    result.notices.push('Issue 中的插件链接与索引记录不一致，请人工确认。');
  }

  if (formData.requestType === '申请下架') {
    const issueAuthor = issue.user?.login || '';
    if (!plugin.author) {
      result.failures.push('当前插件记录缺少 author，无法校验下架申请人身份。');
      return;
    }

    if (plugin.author !== issueAuthor) {
      result.failures.push(
        `申请下架需要插件作者本人提交。当前记录作者是 \`${plugin.author}\`，本次提交用户是 \`${issueAuthor || '未知'}\`。`
      );
    }
  }
}

function buildCommentBody(issue, result) {
  const lines = [
    COMMENT_MARKER,
    '## 插件处理自动审查结果',
    '',
    `- 当前状态：\`${result.status}\``,
    `- 处理类型：${result.extracted.requestType || '未解析到'}`,
    `- 插件名称：${result.extracted.pluginName || '未解析到'}`,
    `- 插件 ID：${result.extracted.pluginId || '未解析到'}`,
    `- 提交用户：${issue.user?.login || '未知'}`,
    '',
  ];

  appendSection(lines, '审查失败项', result.failures);
  appendSection(lines, '提示信息', result.notices);
  appendSection(lines, '已识别插件信息', collectPluginFacts(result.plugin));

  return lines.join('\n');
}

function collectPluginFacts(plugin) {
  if (!plugin) {
    return [];
  }

  return [
    `插件名称：${plugin.name || '-'}`,
    `当前状态：${plugin.status || '-'}`,
    `作者：${plugin.author || '-'}`,
    `仓库地址：${plugin.repositoryUrl || '-'}`,
  ];
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
    '# 插件处理自动审查',
    '',
    `- 状态：\`${result.status}\``,
    `- 处理类型：${result.extracted.requestType || '未解析到'}`,
    `- 插件 ID：${result.extracted.pluginId || '未解析到'}`,
    '',
  ];

  appendSection(lines, '审查失败项', result.failures);
  appendSection(lines, '提示信息', result.notices);

  fs.appendFileSync(summaryPath, `${lines.join('\n')}\n`, 'utf8');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
