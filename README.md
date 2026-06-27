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
3. 填写仓库地址等信息
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
- `manifest.json` 中必须包含插件名称 `name` 和插件描述 `description`
- `manifest.json` 中的 `moekoe` 字段必须为 `true`
- 使用 `moekoe:nativeHost` 时，`manifest.json` 中的 `minversion` 必须大于或等于 `1.6.6`
- 审核只做元数据和静态信息检查，不执行第三方插件代码

### 下架插件的校验规则

- 目标插件必须存在于 `plugins.json`
- `申请下架` 必须由插件作者本人提交
- `举报问题` 不要求必须是插件作者

## 快照与版本规则

仓库保存的是 **审核通过时的插件快照信息**，而不是始终跟随源码仓库最新内容。

### 非编译型插件

- 审查时锁定默认分支当时的 commit
- `snapshotUrl` 保存固定到该 commit 的仓库页面链接
- `downloadUrl` 保存固定到该 commit 的仓库 zip 下载地址

### 编译型插件

- 审查时锁定当前审核版本对应的 `Release tag`
- `downloadUrl` 保存对应发行附件地址
- 最终写入 `plugins.json` 的 `downloadUrl` 与审查评论中的下载地址一致

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
- `downloadUrl`：当前审核通过版本的下载地址
- `buildRequired`：是否需要编译安装
- `networkAccess`：是否检测到网络访问能力
- `fileAccess`：是否检测到本地文件读写能力
- `binaryContent`：是否检测到可执行二进制或 Native Host 能力
- `storageAccess`：是否检测到存储权限
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
- `manifest.json` 中的插件描述应清晰说明真实用途
- `manifest.json` 中需要声明 `moekoe: true`
- 使用 `moekoe:nativeHost` 的插件需要在 `manifest.json` 中声明 `minversion >= 1.6.6`
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

## [插件列表](https://music.moekoe.cn/plugins.html)

<!-- PLUGIN_LIST_START -->
| 图标 | ID | 名称 | 描述 | 版本 | 状态 | 作者 | 下载地址 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <img src="https://raw.githubusercontent.com/BB-CHICKEN/Small-Audio-Info/a468e1c70513e82ba4d5b860aed7fb7a57c62673/icons.jpg" alt="MoeKoe Music 音乐信息显示插件" width="64" height="64"> | [Small-Audio-Info](https://github.com/MoeKoeMusic/MoeKoeMusic-Plugins/issues/104) | [MoeKoe Music 音乐信息显示插件](https://github.com/BB-CHICKEN/Small-Audio-Info) | 在播放器右侧显示当前歌曲的格式和文件大小 | 1.4.0 | 🟢 | [BB-CHICKEN](https://github.com/BB-CHICKEN) | [下载](https://github.com/BB-CHICKEN/Small-Audio-Info/archive/a468e1c70513e82ba4d5b860aed7fb7a57c62673.zip) |
| <img src="https://raw.githubusercontent.com/BB-CHICKEN/MoeKoe-Music-Total-Play-Time/801a992337ec6f25394d371c754f8376ae9c45e3/icons.jpg" alt="MoeKoe Music 累计听歌时长插件" width="64" height="64"> | [Total-Play-time](https://github.com/MoeKoeMusic/MoeKoeMusic-Plugins/issues/103) | [MoeKoe Music 累计听歌时长插件](https://github.com/BB-CHICKEN/MoeKoe-Music-Total-Play-Time) | 在你的个人主页右下角显示累计听歌时长 | 2.2.0 | 🟢 | [BB-CHICKEN](https://github.com/BB-CHICKEN) | [下载](https://github.com/BB-CHICKEN/MoeKoe-Music-Total-Play-Time/archive/801a992337ec6f25394d371c754f8376ae9c45e3.zip) |
| <img src="https://raw.githubusercontent.com/MoeKoeMusic/apple-music-theme/f652541dba25b2f09d2f98104697c887c17915c3/logo.png" alt="Apple Music 主题" width="64" height="64"> | [apple-music-theme](https://github.com/MoeKoeMusic/MoeKoeMusic-Plugins/issues/100) | [Apple Music 主题](https://github.com/MoeKoeMusic/apple-music-theme) | 将 MoeKoe Music 调整为 Apple Music 风格的侧边栏、毛玻璃内容区与悬浮播放器布局主题。 | 1.1.6 | 🟢 | [iAJue](https://github.com/iAJue) | [下载](https://github.com/MoeKoeMusic/apple-music-theme/archive/f652541dba25b2f09d2f98104697c887c17915c3.zip) |
| <img src="https://raw.githubusercontent.com/LateDreamXD/moekoe-blue_archive-theme/v0.3.0/public/assets/icon.png" alt="蔚蓝档案主题" width="64" height="64"> | [blue_archive-theme](https://github.com/MoeKoeMusic/MoeKoeMusic-Plugins/issues/97) | [蔚蓝档案主题](https://github.com/LateDreamXD/moekoe-blue_archive-theme) | The sky blue archive✨ | 0.3.0 | 🟢 | [LateDreamXD](https://github.com/LateDreamXD) | [下载](https://github.com/LateDreamXD/moekoe-blue_archive-theme/releases/download/v0.3.0/ba-theme-v0.3.0.zip) |
| <img src="https://raw.githubusercontent.com/Yngu196/TaskbarLyrics/v0.5.0/public/icons/icon256.png" alt="Windows任务栏歌词插件" width="64" height="64"> | [Taskbar-Lyrics](https://github.com/MoeKoeMusic/MoeKoeMusic-Plugins/issues/96) | [Windows任务栏歌词插件](https://github.com/Yngu196/TaskbarLyrics) | 在 Windows 任务栏上显示逐字高亮歌词，支持卡拉OK效果和播放控制 | 0.5.0 | 🟢 | [Yngu196](https://github.com/Yngu196) | [下载](https://github.com/Yngu196/TaskbarLyrics/releases/download/v0.5.0/moeKoe-taskbar-lyrics.zip) |
| <img src="https://raw.githubusercontent.com/MoeKoeMusic/moekoe-desktop-carousel/d7b09641ea0b1b26a47ce8508dbfe747f8023cd4/icons/icon128.png" alt="MoeKoe 桌面封面轮播" width="64" height="64"> | [moekoe-desktop-carousel](https://github.com/MoeKoeMusic/MoeKoeMusic-Plugins/issues/91) | [MoeKoe 桌面封面轮播](https://github.com/MoeKoeMusic/moekoe-desktop-carousel) | 一个 MoeKoe Music Windows桌面封面轮播插件。 | 1.0.0 | 🟢 | [iAJue](https://github.com/iAJue) | [下载](https://github.com/MoeKoeMusic/moekoe-desktop-carousel/archive/d7b09641ea0b1b26a47ce8508dbfe747f8023cd4.zip) |
| <img src="https://raw.githubusercontent.com/MoeKoeMusic/moekoe-lyric-desktop/f4b755b034e3797efa901d3e459909a6093b918b/icons/icon128.png" alt="MoeKoe 桌面歌词(Windows)" width="64" height="64"> | [moekoe-lyric-desktop](https://github.com/MoeKoeMusic/MoeKoeMusic-Plugins/issues/92) | [MoeKoe 桌面歌词(Windows)](https://github.com/MoeKoeMusic/moekoe-lyric-desktop) | 一个MoeKoe Music的Windows第三方桌面歌词程序插件. | 1.0.0 | 🟢 | [iAJue](https://github.com/iAJue) | [下载](https://github.com/MoeKoeMusic/moekoe-lyric-desktop/archive/f4b755b034e3797efa901d3e459909a6093b918b.zip) |
| <img src="https://raw.githubusercontent.com/RTuioi/MoeKoeMusic-audio-effect-plugin/526f2aac7912d18242446d2e19f3ae03cd74f122/icon-48.png" alt="在线音效插件" width="64" height="64"> | [audio-effect-plugin](https://github.com/MoeKoeMusic/MoeKoeMusic-Plugins/issues/73) | [在线音效插件](https://github.com/RTuioi/MoeKoeMusic-audio-effect-plugin) | 为播放器添加在线音效功能-音效- \|钢琴 \| 乐器 \| 尤克里里 \| 唢呐 \| DJ \| 伴奏 \| - 其他设置-高潮模式（只播放原曲高潮部分） | 1.0.2 | 🟢 | [RTuioi](https://github.com/RTuioi) | [下载](https://github.com/RTuioi/MoeKoeMusic-audio-effect-plugin/archive/526f2aac7912d18242446d2e19f3ae03cd74f122.zip) |
| <img src="https://raw.githubusercontent.com/RTuioi/MoeKoe-EQ-Plugin/e0e56e30f387c6688efee2621b311c4cdc2317c4/icons/icon16.png" alt="MoeKoe EQ - 31段均衡器音效插件" width="64" height="64"> | [moekoe-equalizer](https://github.com/MoeKoeMusic/MoeKoeMusic-Plugins/issues/72) | [MoeKoe EQ - 31段均衡器音效插件](https://github.com/RTuioi/MoeKoe-EQ-Plugin) | MoeKoe EQ - 31 段参数 均衡器 扩展插件，提供 EQ 调节、音效增强 等功能 | 2.0.3 | 🟢 | [RTuioi](https://github.com/RTuioi) | [下载](https://github.com/RTuioi/MoeKoe-EQ-Plugin/archive/e0e56e30f387c6688efee2621b311c4cdc2317c4.zip) |
| <img src="https://raw.githubusercontent.com/MoeKoeMusic/moekoe-comments-panel/f5491f98d451d27d4974a84f5a38ff8e1fe4a314/icons/icon128.png" alt="MoeKoe 评论面板" width="64" height="64"> | [moekoe-comments-panel](https://github.com/MoeKoeMusic/MoeKoeMusic-Plugins/issues/66) | [MoeKoe 评论面板](https://github.com/MoeKoeMusic/moekoe-comments-panel) | 为 MoeKoe Music 增加歌单/专辑评论区。 | 1.0.0 | 🟢 | [iAJue](https://github.com/iAJue) | [下载](https://github.com/MoeKoeMusic/moekoe-comments-panel/archive/f5491f98d451d27d4974a84f5a38ff8e1fe4a314.zip) |
| <img src="https://raw.githubusercontent.com/MoeKoeMusic/custom-background/b33565501f855b56bcb2b8dba034e6eaa4bda3d5/icons/icon16.png" alt="MoeKoe自定义背景插件V2" width="64" height="64"> | [custom-background](https://github.com/MoeKoeMusic/MoeKoeMusic-Plugins/issues/56) | [MoeKoe自定义背景插件V2](https://github.com/MoeKoeMusic/custom-background) | 为 MoeKoe Music自定义个人主页背景和歌单封面插件。 | 2.0.0 | 🟢 | [iAJue](https://github.com/iAJue) | [下载](https://github.com/MoeKoeMusic/custom-background/archive/b33565501f855b56bcb2b8dba034e6eaa4bda3d5.zip) |
| <img src="https://raw.githubusercontent.com/Elysium1314/MoeKoe-Music-Disable-Single-Song-Display/5bbb8996f468dbff3593e36d19e6593b012274f7/icons.jpg" alt="阻止“我喜欢听”下出现神秘单曲" width="64" height="64"> | [disable-single-song-display](https://github.com/MoeKoeMusic/MoeKoeMusic-Plugins/issues/39) | [阻止“我喜欢听”下出现神秘单曲](https://github.com/Elysium1314/MoeKoe-Music-Disable-Single-Song-Display) | 阻止“我喜欢听”下出现奇奇怪怪的单曲，如果你不想看见它们的话，试试这个吧！ | 1.0.0 | 🟢 | [Elysium1314](https://github.com/Elysium1314) | [下载](https://github.com/Elysium1314/MoeKoe-Music-Disable-Single-Song-Display/archive/5bbb8996f468dbff3593e36d19e6593b012274f7.zip) |
| <img src="https://raw.githubusercontent.com/zc217888/moekoe-lyrics-extractor/6d515519e481408673651605827a22ed2f93469e/icons/icon16.svg" alt="歌词提取器" width="64" height="64"> | [moekoe-lyrics-extractor](https://github.com/MoeKoeMusic/MoeKoeMusic-Plugins/issues/33) | [歌词提取器](https://github.com/zc217888/moekoe-lyrics-extractor) | 提取当前播放歌曲的歌词并保存为 TXT 文件，支持翻译歌词和时间戳 | 1.0.0 | 🟢 | [zc217888](https://github.com/zc217888) | [下载](https://github.com/zc217888/moekoe-lyrics-extractor/archive/6d515519e481408673651605827a22ed2f93469e.zip) |
| <img src="https://raw.githubusercontent.com/chenyang137/MoeKoeMusic-artist-plugin/aeb8e51cd531306d6275be226844880a0ed0f452/icon-48.png" alt="歌手写真轮播" width="64" height="64"> | [artist-plugin](https://github.com/MoeKoeMusic/MoeKoeMusic-Plugins/issues/26) | [歌手写真轮播](https://github.com/chenyang137/MoeKoeMusic-artist-plugin) | 为 MoeKoeMusic 播放器添加歌手写真轮播功能，在全屏歌词界面展示歌手写真背景图并自动轮播。 | 1.0.2 | 🟢 | [chenyang137](https://github.com/chenyang137) | [下载](https://github.com/chenyang137/MoeKoeMusic-artist-plugin/archive/aeb8e51cd531306d6275be226844880a0ed0f452.zip) |
| <img src="https://raw.githubusercontent.com/MoeKoeMusic/custom-app-background-plugin/dbf72d38c8cf6b1d1cefdf8ce15798d565678995/icons/icon16.png" alt="自定义背景图" width="64" height="64"> | [custom-app-background](https://github.com/MoeKoeMusic/MoeKoeMusic-Plugins/issues/10) | [自定义背景图](https://github.com/MoeKoeMusic/custom-app-background-plugin) | 为MoeKoe Music提供自定义背景图能力，支持透明度调节。 | 1.0.0 | 🟢 | [iAJue](https://github.com/iAJue) | [下载](https://github.com/MoeKoeMusic/custom-app-background-plugin/archive/dbf72d38c8cf6b1d1cefdf8ce15798d565678995.zip) |
<!-- PLUGIN_LIST_END -->
