const {
  isModerationIssue,
  loadContext,
  parseIssueSections,
} = require('./lib/publish-plugin-common');
const { findPluginById, updatePluginStatus, updateReadmePluginList } = require('./lib/plugin-registry');

const FIELD_TITLES = {
  requestType: '处理类型',
  pluginName: '插件名称',
  pluginId: '插件唯一 ID',
  repositoryUrl: '插件仓库或市场页面链接',
  requestReason: '原因分类',
  issueDescription: '详细说明',
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

  if (issue.state_reason !== 'completed') {
    console.log(`当前关闭原因是 ${issue.state_reason || 'unknown'}，不执行状态修改。`);
    return;
  }

  const formData = parseModerationForm(issue.body || '');
  validateRequiredFields(formData);

  const plugin = findPluginById(formData.pluginId);
  if (!plugin) {
    throw new Error(`未在 plugins.json 中找到插件 ID 为 ${formData.pluginId} 的记录。`);
  }

  validateModerationPermission(plugin, formData, issue);

  updatePluginStatus(plugin.id, 'delisted');
  updateReadmePluginList();

  console.log(`插件 ${plugin.id} 状态已更新为 delisted，并同步更新 README。`);
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

function validateRequiredFields(formData) {
  const requiredFields = [
    ['处理类型', formData.requestType],
    ['插件名称', formData.pluginName],
    ['插件唯一 ID', formData.pluginId],
    ['插件仓库或市场页面链接', formData.repositoryUrl],
    ['原因分类', formData.requestReason],
    ['详细说明', formData.issueDescription],
  ];

  const missing = requiredFields.filter(([, value]) => !value).map(([label]) => label);
  if (missing.length > 0) {
    throw new Error(`缺少必要字段：${missing.join('、')}`);
  }
}

function validateModerationPermission(plugin, formData, issue) {
  const issueAuthor = issue.user?.login || '';

  if (formData.requestType === '申请下架') {
    if (!plugin.author) {
      throw new Error('当前插件记录缺少 author，无法校验下架申请人身份。');
    }

    if (plugin.author !== issueAuthor) {
      throw new Error(
        `申请下架需要插件作者本人提交。当前记录作者是 ${plugin.author}，本次提交用户是 ${issueAuthor || '未知'}。`
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
