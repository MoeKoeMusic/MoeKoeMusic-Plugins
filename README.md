# MoeKoeMusic Plugins

MoeKoeMusic 官方插件登记与索引仓库。

这个仓库不是插件源码仓库，而是 **插件市场登记仓库**，主要负责接收插件申请、保存审核通过后的快照信息，并维护客户端可读取的插件索引。

## 仓库用途

这个仓库主要用于：

- 接收插件提交申请
- 接收下架插件申请（如下架、举报）
- 保存审核通过后的插件快照元数据
- 维护客户端可读取的插件索引文件 `plugins.json`
- 展示当前已登记插件列表

## 申请类型

当前仓库主要提供两类 Issue 入口：

- `上架插件`
  - 用于 **新上架插件**
  - 也用于 **更新已上架插件**
- `下架插件`
  - 用于 **申请下架插件**
  - 也用于 **举报插件存在安全、侵权、恶意行为或其他问题**

## 申请流程

### 上架插件

1. 通过 `上架插件` 模板创建 Issue
2. 选择 `操作类型`
   - `新上架`
   - `更新插件`
3. 填写插件名称、仓库地址、描述等信息
4. Action 自动进行基础校验
5. 维护者人工审核
6. 审核通过后使用 `Close as completed`
7. Action 自动生成 PR
8. PR 合并后，`plugins.json` 和 `README.md` 更新

### 下架插件

1. 通过 `下架插件` 模板创建 Issue
2. 选择处理类型
   - `申请下架`
   - `举报问题`
3. 填写目标插件信息和处理原因
4. Action 自动检查插件是否存在
5. 如果是 `申请下架`，还会校验当前提交用户是否为该插件作者
6. 维护者人工审核
7. 审核通过后使用 `Close as completed`
8. Action 自动生成 PR，并将插件状态改为 `delisted`

## 审核规则

### 上架插件的校验规则

- 必填字段必须完整
- `新上架` 时，插件 ID 不能已存在
- `更新插件` 时，插件 ID 必须已存在
- `更新插件` 必须由当前插件作者本人提交
- 插件仓库必须可公开访问
- 仓库中必须存在 `manifest.json`
- `manifest.json` 中必须包含合法的 `plugin_id`
- 审核只做元数据和静态信息检查，不执行第三方插件代码

### 下架插件的校验规则

- 目标插件必须存在于 `plugins.json`
- `申请下架` 必须由插件作者本人提交
- `举报问题` 不要求必须是插件作者

## 快照与版本规则

仓库保存的是 **审核通过时的插件快照信息**，而不是始终跟随源码仓库最新内容。

### 非编译型插件

- 审查时锁定默认分支当时的 commit
- `downloadUrl` 保存固定到该 commit 的仓库链接
- 最终写入 `plugins.json` 的地址与审查评论中的快照地址一致

### 编译型插件

- 审查时锁定当前审核版本对应的 `Release tag`
- `downloadUrl` 保存对应发行附件地址
- 最终写入 `plugins.json` 的地址与审查评论中的快照地址一致

## 数据说明

`plugins.json` 保存审核通过后的插件记录。

当前主要字段包括：

- `id`：插件唯一 ID
- `name`：插件名称
- `description`：插件描述
- `iconUrl`：插件图标地址
- `version`：当前已审核版本
- `status`：插件状态
- `author`：提交该插件申请的 GitHub 用户名
- `repositoryUrl`：插件源码仓库地址
- `downloadUrl`：当前审核通过快照的访问地址
- `buildRequired`：是否需要编译安装
- `approvedAt`：审核通过时间
- `approvedIssueNumber`：对应审核 Issue 编号
- `approvedIssueUrl`：对应审核 Issue 地址
- `snapshot`：当前审核通过版本的快照信息

插件状态：

- `active`：正常上架 🟢
- `delisted`：已下架 🔴

## 申请注意事项

提交申请前，请注意以下内容：

- 不要提交私有仓库或无权限访问的仓库
- 仓库中必须包含有效的 `manifest.json`
- 插件描述应清晰说明用途，不要只写极短说明
- 如果是 `更新插件`，请确认当前提交账号就是插件记录中的作者账号
- 如果插件需要编译安装，请确保对应审核版本已有可下载的发行产物
- 如果插件不需要编译安装，仓库应能直接对应到可审核的源码快照
- 请不要在申请中提供无法验证的下载地址或模糊版本描述
- 举报类申请请尽量提供清晰证据，便于维护者判断
- 插件Bug请前往原仓库反馈

## 审核结果说明

仓库中的自动化流程不会直接执行第三方插件代码。

审核结果通常分为两种：

- `check-passed`：自动校验通过，可进入人工审核
- `check-failed`：自动校验失败，需要补充信息或修正问题后重新提交

Issue 关闭方式含义如下：

- `Close as completed`：审核通过，自动生成 PR
- `Close as not planned`：审核不通过，不做数据变更

## 插件列表

<!-- PLUGIN_LIST_START -->
| 图标 | ID | 名称 | 描述 | 版本 | 状态 | 作者 | 下载地址 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <img src="https://raw.githubusercontent.com/RTuioi/MoeKoe-EQ-Plugin/6d244c38c562ba211cce1d6948d8a21fc2ee4ad3/icons/icon16.svg" alt="MoeKoe EQ 均衡器音效插件 （提升听感）" width="64" height="64"> | moekoe-equalizer | MoeKoe EQ 均衡器音效插件 （提升听感） | 31段参数均衡器插件，为 MoeKoeMusic 提供音频处理，有效提升听感体验。<br><br>**主要功能：**<br>- 31段参数均衡器（20Hz-20kHz，±6dB 可调）<br>- 11种内置预设（平坦、摇滚、古典、流行、爵士、低音增强、高音增强、人声、风雪调音、极致听感、醇美空间）<br>- 自定义预设保存与管理<br>- 音效增强（低频提升、清晰度、环绕声、混响等）<br>- 输出增益与声道平衡控制<br>- 实时 EQ 曲线可视化<br><br>**首次使用：** 安装后请点击托盘 → MoeKoeMusic → 重启应用 | 1.0.0 | 🟢 | RTuioi | [下载](https://github.com/RTuioi/MoeKoe-EQ-Plugin/tree/6d244c38c562ba211cce1d6948d8a21fc2ee4ad3) |
| <img src="https://raw.githubusercontent.com/chenyang137/MoeKoeMusic-artist-plugin/aeb8e51cd531306d6275be226844880a0ed0f452/icon-48.png" alt="歌手写真轮播" width="64" height="64"> | artist-plugin | 歌手写真轮播 | 为 MoeKoeMusic 播放器添加歌手写真轮播功能，在全屏歌词界面展示歌手写真背景图并自动轮播。 | 1.0.2 | 🟢 | chenyang137 | [下载](https://github.com/chenyang137/MoeKoeMusic-artist-plugin/tree/aeb8e51cd531306d6275be226844880a0ed0f452) |
| <img src="https://raw.githubusercontent.com/MoeKoeMusic/apple-music-theme/63ca32bd880382af24f9fca68abb80bb4796ca30/logo.png" alt="Apple Music 主题" width="64" height="64"> | apple-music-theme | Apple Music 主题 | 将 MoeKoe Music 调整为 Apple Music 风格的侧边栏、毛玻璃内容区与悬浮播放器布局主题。 | 1.1.0 | 🟢 | iAJue | [下载](https://github.com/MoeKoeMusic/apple-music-theme/tree/63ca32bd880382af24f9fca68abb80bb4796ca30) |
| <img src="https://raw.githubusercontent.com/BB-CHICKEN/Small-Audio-Info/b293c91b1dd346f0ec2b85698a597cff87aed6a4/icons.jpg" alt="playbar歌曲信息显示" width="64" height="64"> | Small-Audio-Info | playbar歌曲信息显示 | 在播放器右侧显示当前歌曲的格式和文件大小 | 1.1.0 | 🟢 | BB-CHICKEN | [下载](https://github.com/BB-CHICKEN/Small-Audio-Info/tree/b293c91b1dd346f0ec2b85698a597cff87aed6a4) |
| <img src="https://raw.githubusercontent.com/BB-CHICKEN/MoeKoe-Music-Total-Play-Time/b4f2ada120a95cac40cd5171b5c852c76492d7b5/icons.jpg" alt="累计播放时长" width="64" height="64"> | Total-Play-time | 累计播放时长 | 为播放器的个人主页背景右下方加入累计播放时长统计 | 1.2.0 | 🟢 | BB-CHICKEN | [下载](https://github.com/BB-CHICKEN/MoeKoe-Music-Total-Play-Time/tree/b4f2ada120a95cac40cd5171b5c852c76492d7b5) |
| <img src="https://raw.githubusercontent.com/MoeKoeMusic/custom-app-background-plugin/dbf72d38c8cf6b1d1cefdf8ce15798d565678995/icons/icon16.png" alt="自定义背景图" width="64" height="64"> | custom-app-background | 自定义背景图 | 为MoeKoe Music提供自定义背景图能力，支持透明度调节。 | 1.0.0 | 🟢 | iAJue | [下载](https://github.com/MoeKoeMusic/custom-app-background-plugin/tree/dbf72d38c8cf6b1d1cefdf8ce15798d565678995) |
| <img src="https://raw.githubusercontent.com/MoeKoeMusic/custom-background/9f062085018c6dc06ef597778d4a89eeeaeddacf/icons/icon16.png" alt="MoeKoe Music Library" width="64" height="64"> | custom-background | MoeKoe Music Library | 这是一个为 MoeKoe Music Library 页面开发的简单自定义背景和歌单封面插件。 | 1.2.1 | 🟢 | iAJue | [下载](https://github.com/MoeKoeMusic/custom-background/tree/9f062085018c6dc06ef597778d4a89eeeaeddacf) |
<!-- PLUGIN_LIST_END -->
