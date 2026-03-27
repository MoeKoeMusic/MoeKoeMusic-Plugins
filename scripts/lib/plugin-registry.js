// 脚本作用：管理插件索引文件 plugins.json，并维护 README 中的插件列表展示。
const fs = require('fs');
const path = require('path');

const README_PLUGIN_LIST_START = '<!-- PLUGIN_LIST_START -->';
const README_PLUGIN_LIST_END = '<!-- PLUGIN_LIST_END -->';

function readPluginRegistry() {
  const pluginsPath = path.join(process.cwd(), 'plugins.json');
  if (!fs.existsSync(pluginsPath)) {
    return [];
  }

  const data = JSON.parse(fs.readFileSync(pluginsPath, 'utf8'));
  if (!Array.isArray(data)) {
    throw new Error('plugins.json 必须是数组。');
  }

  return data;
}

function findPluginById(pluginId) {
  return readPluginRegistry().find((item) => item && typeof item === 'object' && item.id === pluginId) || null;
}

function upsertPluginRecord(pluginRecord) {
  const next = readPluginRegistry().filter((item) => item?.id !== pluginRecord.id);
  writePluginRegistry([pluginRecord, ...next]);
}

function updatePluginStatus(pluginId, status) {
  const plugins = readPluginRegistry();
  const index = plugins.findIndex((item) => item && typeof item === 'object' && item.id === pluginId);
  if (index === -1) {
    throw new Error(`未在 plugins.json 中找到插件 ID 为 ${pluginId} 的记录。`);
  }

  const current = plugins[index];
  plugins[index] = {
    ...current,
    status,
  };

  writePluginRegistry(plugins);
  return plugins[index];
}

function writePluginRegistry(plugins) {
  const pluginsPath = path.join(process.cwd(), 'plugins.json');
  fs.writeFileSync(pluginsPath, `${JSON.stringify(plugins, null, 2)}\n`, 'utf8');
}

function updateReadmePluginList() {
  const readmePath = path.join(process.cwd(), 'README.md');
  if (!fs.existsSync(readmePath)) {
    throw new Error('README.md 不存在，无法更新插件列表。');
  }

  const readme = fs.readFileSync(readmePath, 'utf8');
  const startIndex = readme.indexOf(README_PLUGIN_LIST_START);
  const endIndex = readme.indexOf(README_PLUGIN_LIST_END);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error('README.md 中的插件列表占位顺序无效。');
  }

  const table = buildPluginTable(readPluginRegistry());
  const replacement = `${README_PLUGIN_LIST_START}\n${table}\n${README_PLUGIN_LIST_END}`;
  const nextReadme = [
    readme.slice(0, startIndex),
    replacement,
    readme.slice(endIndex + README_PLUGIN_LIST_END.length),
  ].join('');

  fs.writeFileSync(readmePath, nextReadme, 'utf8');
}

function buildPluginTable(plugins) {
  const rows = Array.isArray(plugins) && plugins.length > 0 ? plugins.map(toPluginTableRow) : ['| - | - | 暂无插件 | - | - | - | - | - |'];
  return [
    '| 图标 | ID | 名称 | 描述 | 版本 | 状态 | 作者 | 下载地址 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
  ].join('\n');
}

function toPluginTableRow(plugin) {
  const iconCell = buildPluginIconCell(plugin);
  const cells = [
    plugin.id,
    plugin.name || plugin.id,
    plugin.description || '-',
    plugin.version || '-',
    formatPluginStatus(plugin.status),
    plugin.author || '-',
  ].map(escapeMarkdownCell);

  const downloadLink = plugin.downloadUrl ? `[下载](${plugin.downloadUrl})` : '-';
  return `| ${iconCell} | ${cells[0]} | ${cells[1]} | ${cells[2]} | ${cells[3]} | ${cells[4]} | ${cells[5]} | ${downloadLink} |`;
}

function buildPluginIconCell(plugin) {
  const iconUrl = resolvePluginIconUrl(plugin);
  if (!iconUrl) {
    return '-';
  }

  const alt = escapeHtmlAttribute(plugin.name || plugin.id || 'plugin icon');
  return `<img src="${iconUrl}" alt="${alt}" width="64" height="64">`;
}

function resolvePluginIconUrl(plugin) {
  if (plugin?.iconUrl) {
    return plugin.iconUrl;
  }

  if (plugin?.snapshot?.iconUrl) {
    return plugin.snapshot.iconUrl;
  }

  return '';
}

function formatPluginStatus(status) {
  if (status === 'active') {
    return '🟢';
  }

  if (status === 'delisted') {
    return '🔴';
  }

  return status || '-';
}

function escapeMarkdownCell(value) {
  return String(value || '-').replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}

function escapeHtmlAttribute(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

module.exports = {
  findPluginById,
  readPluginRegistry,
  updatePluginStatus,
  updateReadmePluginList,
  upsertPluginRecord,
};
