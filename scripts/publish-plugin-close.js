const {
  githubRequest,
  isPublishIssue,
  loadContext,
} = require('./lib/publish-plugin-common');
const { findPluginById, updateReadmePluginList, upsertPluginRecord } = require('./lib/plugin-registry');

const COMMENT_MARKER = '<!-- plugin-publish-validation -->';
const SNAPSHOT_MARKER_PREFIX = '<!-- plugin-publish-snapshot:';
const SNAPSHOT_MARKER_SUFFIX = ' -->';

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

  if (issue.state_reason !== 'completed') {
    console.log(`当前关闭原因是 ${issue.state_reason || 'unknown'}，不执行入库。`);
    return;
  }

  const validationPayload = await readValidationPayload(context, issue.number);
  validatePayload(validationPayload);

  const existingPlugin = findPluginById(validationPayload.plugin.id);
  const pluginRecord = buildPluginRecord(issue, validationPayload, existingPlugin);

  upsertPluginRecord(pluginRecord);
  updateReadmePluginList();

  console.log(`插件 ${pluginRecord.id} 已根据审查快照写入 plugins.json，并更新 README 列表。`);
}

async function readValidationPayload(context, issueNumber) {
  const [owner, repo] = context.repository.split('/');
  const commentsResponse = await githubRequest(
    context,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}/comments?per_page=100`
  );
  const comments = Array.isArray(commentsResponse.data) ? commentsResponse.data : [];
  const validationComment = comments.find((comment) => comment.body?.includes(COMMENT_MARKER));

  if (!validationComment?.body) {
    throw new Error('未找到插件提交审查评论，无法读取锁定快照。');
  }

  const payloadMatch = validationComment.body.match(/<!-- plugin-publish-snapshot:([A-Za-z0-9+/=]+) -->/);
  if (!payloadMatch) {
    throw new Error('审查评论中缺少快照数据。');
  }

  const encodedPayload = payloadMatch[1];
  const jsonText = Buffer.from(encodedPayload, 'base64').toString('utf8');
  return JSON.parse(jsonText);
}

function validatePayload(payload) {
  if (!payload || payload.schema !== 'publish-validation-v1') {
    throw new Error('审查评论中的快照数据格式无效。');
  }

  if (payload.status !== 'check-passed') {
    throw new Error('当前 issue 的审查状态不是 check-passed，不能执行入库。');
  }

  if (!payload.snapshot?.downloadUrl) {
    throw new Error('审查评论中缺少锁定快照地址。');
  }
}

function buildPluginRecord(issue, payload, existingPlugin) {
  const isUpdate = payload.operationType === '更新插件';
  const nextStatus = isUpdate ? 'active' : existingPlugin?.status || 'active';

  if (isUpdate) {
    validateUpdate(existingPlugin, issue, payload);
  }

  if (!isUpdate && existingPlugin) {
    throw new Error(`插件 ID ${payload.plugin.id} 已存在，不能按新上架方式写入。`);
  }

  return {
    id: payload.plugin.id,
    name: payload.plugin.name,
    description: payload.plugin.description,
    version: payload.snapshot.version,
    status: nextStatus,
    author: existingPlugin?.author || payload.issueAuthor,
    repositoryUrl: payload.plugin.repositoryUrl,
    downloadUrl: payload.snapshot.downloadUrl,
    buildRequired: payload.plugin.buildRequired,
    networkAccess: payload.plugin.networkAccess,
    fileAccess: payload.plugin.fileAccess,
    binaryContent: payload.plugin.binaryContent,
    approvedAt: new Date().toISOString(),
    approvedIssueNumber: issue.number,
    approvedIssueUrl: issue.html_url,
    snapshot: payload.snapshot,
  };
}

function validateUpdate(existingPlugin, issue, payload) {
  if (!existingPlugin) {
    throw new Error(`插件 ID ${payload.plugin.id} 不存在，不能执行更新。`);
  }

  const issueAuthor = issue.user?.login || '';
  if (!existingPlugin.author || existingPlugin.author !== issueAuthor) {
    throw new Error(
      `更新插件需要作者本人提交。当前记录作者是 ${existingPlugin.author || '未知'}，本次提交用户是 ${issueAuthor || '未知'}。`
    );
  }

  if (existingPlugin.repositoryUrl && existingPlugin.repositoryUrl !== payload.plugin.repositoryUrl) {
    throw new Error('更新插件时仓库地址必须与当前记录一致。');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
