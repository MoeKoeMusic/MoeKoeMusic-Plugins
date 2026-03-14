const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const {
  fetchRepository,
  githubRequest,
  isPublishIssue,
  isYesOption,
  loadContext,
  parseIssueForm,
  parseRepositoryReference,
} = require('./lib/publish-plugin-common');
const { resolvePublishSnapshot } = require('./lib/publish-snapshot');

const execFileAsync = promisify(execFile);
const COMMENT_MARKER = '<!-- plugin-publish-ai-audit -->';
const DEFAULT_API_PATH = '/chat/completions';
const MAX_FILE_COUNT = 24;
const MAX_FILE_CHARS = 6000;
const MAX_TOTAL_CHARS = 50000;

async function main() {
  const context = loadContext();
  const issue = context.payload.issue;

  if (!issue) {
    throw new Error('当前事件不包含 issue 数据。');
  }

  if (!isPublishIssue(context.payload)) {
    console.log('当前 issue 不是插件提交请求，跳过 AI 审核。');
    return;
  }

  if (!hasAiAuditConfig()) {
    await writeStepSummary(['# AI 审核', '', '- 未配置 AI 审核接口，已跳过。']);
    console.log('AI 审核配置缺失，跳过执行。');
    return;
  }

  const formData = parseIssueForm(issue.body || '');
  const repositoryRef = parseRepositoryReference(formData.repositoryUrl);
  if (!repositoryRef) {
    console.log('仓库地址无效，跳过 AI 审核。');
    return;
  }

  const repository = await fetchRepository(context, repositoryRef, { allow404: true });
  if (!repository || repository.private) {
    console.log('仓库不可访问或为私有仓库，跳过 AI 审核。');
    return;
  }

  const snapshot = await resolvePublishSnapshot(context, repositoryRef, repository, isYesOption(formData.buildRequired));
  if (snapshot.error) {
    await upsertAuditComment(context, issue.number, buildAuditSkippedComment(snapshot.error));
    await writeStepSummary(['# AI 审核', '', `- 跳过原因：${snapshot.error}`]);
    return;
  }

  const workspace = await prepareSnapshotWorkspace(snapshot);
  try {
    const auditInput = await collectAuditInput(workspace, repository, snapshot, formData);
    const aiResult = await requestAiAudit(auditInput);
    const comment = buildAuditComment(aiResult, snapshot, auditInput);
    await upsertAuditComment(context, issue.number, comment);
    await writeStepSummary(buildAuditSummary(aiResult, snapshot));
  } finally {
    cleanupDirectory(workspace.rootDir);
  }
}

function hasAiAuditConfig() {
  return Boolean(process.env.AI_AUDIT_API_URL && process.env.AI_AUDIT_API_KEY && process.env.AI_AUDIT_MODEL);
}

async function prepareSnapshotWorkspace(snapshot) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-ai-audit-'));
  const archivePath = path.join(rootDir, 'snapshot.zip');
  const extractDir = path.join(rootDir, 'source');
  fs.mkdirSync(extractDir, { recursive: true });

  const archiveUrl = buildArchiveUrl(snapshot);
  const response = await fetch(archiveUrl);
  if (!response.ok) {
    throw new Error(`下载仓库快照失败：${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(archivePath, buffer);

  await execFileAsync('unzip', ['-q', archivePath, '-d', extractDir]);

  const extractedEntries = fs.readdirSync(extractDir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  const sourceDir = extractedEntries.length > 0 ? path.join(extractDir, extractedEntries[0].name) : extractDir;

  return { rootDir, sourceDir, archiveUrl };
}

function buildArchiveUrl(snapshot) {
  const ref = snapshot.type === 'release-asset' ? snapshot.release.tag : snapshot.commitSha;
  return `https://codeload.github.com/${snapshot.repository}/zip/${ref}`;
}

async function collectAuditInput(workspace, repository, snapshot, formData) {
  const fileEntries = collectCandidateFiles(workspace.sourceDir);
  const prioritized = prioritizeFiles(fileEntries);
  const selectedFiles = loadSelectedFiles(prioritized);

  return {
    repository: repository.full_name,
    repositoryUrl: repository.html_url,
    operationType: formData.operationType,
    pluginId: formData.pluginId,
    pluginName: formData.pluginName,
    buildRequired: isYesOption(formData.buildRequired),
    snapshot,
    archiveUrl: workspace.archiveUrl,
    selectedFiles,
  };
}

function collectCandidateFiles(sourceDir) {
  const entries = [];
  walkDirectory(sourceDir, sourceDir, entries);
  return entries;
}

function walkDirectory(rootDir, currentDir, entries) {
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    const fullPath = path.join(currentDir, entry.name);
    const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      if (shouldIgnoreDirectory(entry.name)) {
        continue;
      }
      walkDirectory(rootDir, fullPath, entries);
      continue;
    }

    if (!entry.isFile() || shouldIgnoreFile(relativePath)) {
      continue;
    }

    entries.push({ fullPath, relativePath, score: scoreFile(relativePath) });
  }
}

function shouldIgnoreDirectory(name) {
  return ['.git', 'node_modules', 'dist', 'build', 'coverage', '.next', 'out', '.cache', 'vendor'].includes(name);
}

function shouldIgnoreFile(relativePath) {
  const lower = relativePath.toLowerCase();
  if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.gif') || lower.endsWith('.webp') || lower.endsWith('.ico') || lower.endsWith('.svg') || lower.endsWith('.lock')) {
    return true;
  }

  return false;
}

function scoreFile(relativePath) {
  const lower = relativePath.toLowerCase();
  let score = 0;

  if (lower === 'manifest.json') {
    score += 100;
  }
  if (lower.endsWith('package.json')) {
    score += 80;
  }
  if (/(index|main|app|plugin|background|content|server)\.(js|ts|mjs|cjs|jsx|tsx)$/.test(lower)) {
    score += 40;
  }
  if (/\.(js|ts|mjs|cjs|jsx|tsx|json|vue)$/.test(lower)) {
    score += 20;
  }
  if (/(api|request|fetch|network|http|auth|token|exec|child_process|fs|storage|inject|eval)/.test(lower)) {
    score += 30;
  }

  return score;
}

function prioritizeFiles(entries) {
  return [...entries].sort((left, right) => right.score - left.score || left.relativePath.localeCompare(right.relativePath));
}

function loadSelectedFiles(entries) {
  const selected = [];
  let totalChars = 0;

  for (const entry of entries) {
    if (selected.length >= MAX_FILE_COUNT || totalChars >= MAX_TOTAL_CHARS) {
      break;
    }

    const raw = fs.readFileSync(entry.fullPath);
    if (isBinaryContent(raw)) {
      continue;
    }

    const text = raw.toString('utf8');
    const content = text.length > MAX_FILE_CHARS ? `${text.slice(0, MAX_FILE_CHARS)}\n/* truncated */` : text;

    selected.push({ path: entry.relativePath, content });
    totalChars += content.length;
  }

  return selected;
}

function isBinaryContent(buffer) {
  const sample = buffer.subarray(0, Math.min(buffer.length, 512));
  return sample.includes(0);
}

async function requestAiAudit(auditInput) {
  const apiUrl = normalizeApiUrl(process.env.AI_AUDIT_API_URL);
  const body = {
    model: process.env.AI_AUDIT_MODEL,
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content:
          'You are a security-focused code reviewer. Perform a minimal static audit of the provided plugin snapshot. Check for malicious behavior, risky patterns, and obvious bugs. Return strict JSON only.',
      },
      {
        role: 'user',
        content: buildAuditPrompt(auditInput),
      },
    ],
    response_format: { type: 'json_object' },
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.AI_AUDIT_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI 审核接口调用失败：${response.status} ${text}`);
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content;
  if (!rawContent) {
    throw new Error('AI 审核接口未返回有效内容。');
  }

  return parseAiJsonResponse(rawContent);
}

function parseAiJsonResponse(rawContent) {
  const content = Array.isArray(rawContent)
    ? rawContent.map((item) => (typeof item === 'string' ? item : item?.text || '')).join('')
    : String(rawContent);

  const trimmed = content.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenced) {
      return JSON.parse(fenced[1]);
    }

    const objectMatch = trimmed.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0]);
    }

    throw new Error(`AI 返回内容不是有效 JSON：${trimmed.slice(0, 200)}`);
  }
}

function normalizeApiUrl(baseUrl) {
  const trimmed = String(baseUrl || '').replace(/\/$/, '');
  if (trimmed.endsWith('/chat/completions')) {
    return trimmed;
  }
  return `${trimmed}${DEFAULT_API_PATH}`;
}

function buildAuditPrompt(auditInput) {
  const fileBlocks = auditInput.selectedFiles
    .map((file) => [`### ${file.path}`, '```', file.content, '```'].join('\n'))
    .join('\n\n');

  return [
    'Please review this plugin snapshot with a minimal static audit.',
    '',
    `Repository: ${auditInput.repository}`,
    `Plugin ID: ${auditInput.pluginId}`,
    `Plugin Name: ${auditInput.pluginName}`,
    `Operation Type: ${auditInput.operationType}`,
    `Build Required: ${auditInput.buildRequired}`,
    `Snapshot Type: ${auditInput.snapshot.type}`,
    `Snapshot Ref: ${auditInput.snapshot.reviewRef}`,
    `Snapshot URL: ${auditInput.snapshot.snapshotUrl || auditInput.snapshot.downloadUrl}`,
    `Archive URL: ${auditInput.archiveUrl}`,
    '',
    'Focus on:',
    '- malicious behavior',
    '- risky code patterns',
    '- obvious bugs',
    '- concise practical suggestions',
    '',
    'Return JSON with this shape:',
    '{"summary":"...","risk_level":"low|medium|high","findings":[{"level":"low|medium|high","title":"...","details":"...","path":"..."}],"suggestions":["..."]}',
    '',
    'Files:',
    fileBlocks,
  ].join('\n');
}

function buildAuditComment(aiResult, snapshot, auditInput) {
  const lines = [
    COMMENT_MARKER,
    '## AI 代码审查结果',
    '',
    `- 风险等级：\`${aiResult.risk_level || 'unknown'}\``,
    `- 审核版本：${snapshot.version}`,
    `- 仓库快照：${snapshot.snapshotUrl || snapshot.downloadUrl}`,
  ];

  if (snapshot.type === 'release-asset') {
    lines.push(`- 发行包地址：${snapshot.downloadUrl}`);
  }

  lines.push(`- 审查文件数：${auditInput.selectedFiles.length}`, '');

  appendSection(lines, '总结', aiResult.summary ? [aiResult.summary] : []);
  appendSection(lines, '发现项', formatFindings(aiResult.findings));
  appendSection(lines, '建议', Array.isArray(aiResult.suggestions) ? aiResult.suggestions : []);

  return lines.join('\n');
}

function buildAuditSummary(aiResult, snapshot) {
  const lines = [
    '# AI 代码审查',
    '',
    `- 风险等级：\`${aiResult.risk_level || 'unknown'}\``,
    `- 审核版本：${snapshot.version}`,
    `- 仓库快照：${snapshot.snapshotUrl || snapshot.downloadUrl}`,
    '',
  ];

  appendSection(lines, '总结', aiResult.summary ? [aiResult.summary] : []);
  appendSection(lines, '建议', Array.isArray(aiResult.suggestions) ? aiResult.suggestions : []);

  return lines;
}

function formatFindings(findings) {
  if (!Array.isArray(findings)) {
    return [];
  }

  return findings.map((finding) => {
    const level = finding.level || 'unknown';
    const title = finding.title || '未命名问题';
    const details = finding.details || '';
    const target = finding.path ? `（${finding.path}）` : '';
    return `[${level}] ${title}${target}${details ? `：${details}` : ''}`;
  });
}

function appendSection(lines, title, items) {
  lines.push(`### ${title}`);
  if (!items || items.length === 0) {
    lines.push('- 无', '');
    return;
  }

  for (const item of items) {
    lines.push(`- ${item}`);
  }
  lines.push('');
}

function buildAuditSkippedComment(reason) {
  return [
    COMMENT_MARKER,
    '## AI 代码审查结果',
    '',
    `- 已跳过：${reason}`,
  ].join('\n');
}

async function upsertAuditComment(context, issueNumber, body) {
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

async function writeStepSummary(lines) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) {
    return;
  }

  fs.appendFileSync(summaryPath, `${lines.join('\n')}\n`, 'utf8');
}

function cleanupDirectory(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
