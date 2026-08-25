# MoeKoeMusic Plugins

MoeKoeMusic 官方插件登记与索引仓库。

这个仓库不是插件源码仓库，而是 **插件市场登记仓库**，主要负责接收插件申请、保存审核通过后的快照信息，并维护客户端可读取的插件索引。

👉 [上架/更新插件](https://github.com/MoeKoeMusic/MoeKoeMusic-Plugins/issues/new?template=plugin_publish.yml)  | 🚫 [下架/举报插件](https://github.com/MoeKoeMusic/MoeKoeMusic-Plugins/issues/new?template=plugin_delist.yml)


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
| <img src="https://raw.githubusercontent.com/Yngu196/TaskbarLyrics/v1.0.5/public/icons/icon256.png" alt="Windows任务栏歌词插件" width="64" height="64"> | [Taskbar-Lyrics](https://github.com/MoeKoeMusic/MoeKoeMusic-Plugins/issues/182) | [Windows任务栏歌词插件](https://github.com/Yngu196/TaskbarLyrics) | 在 Windows 任务栏上显示逐字高亮歌词，支持卡拉OK效果和播放控制 | 1.0.5 | 🟢 | [Yngu196](https://github.com/Yngu196) | [下载](https://github.com/Yngu196/TaskbarLyrics/releases/download/v1.0.5/moeKoe-taskbar-lyrics.zip) |
| - | [moekoe-hide-default-playlists](https://github.com/MoeKoeMusic/MoeKoeMusic-Plugins/issues/180) | [MoeKoe 隐藏默认歌单](https://github.com/jeffernn/moekoe-hide-default-playlists) | 隐藏音乐库与侧边栏中软件自带的的默认歌单及入口（我的云盘、本地音乐、创建歌单、我喜欢、默认收藏），支持隐藏筛选配置。 | 1.0.2 | 🟢 | [jeffernn](https://github.com/jeffernn) | [下载](https://github.com/jeffernn/moekoe-hide-default-playlists/archive/33732321996451a0d5eb07da5a5e05021f8b8e0b.zip) |
| <img src="https://raw.githubusercontent.com/1153683020/MoeKoe-Music-SearchTips-Stable/07de9d5927d44edc8e8671ce0c15ce83ec553a09/icons/icon.png" alt="搜索建议" width="64" height="64"> | [com.moekoe.search-suggest](https://github.com/MoeKoeMusic/MoeKoeMusic-Plugins/issues/172) | [搜索建议](https://github.com/1153683020/MoeKoe-Music-SearchTips-Stable) | 在搜索框中输入关键词时，实时显示搜索建议和热度 | 1.0.0 | 🟢 | [1153683020](https://github.com/1153683020) | [下载](https://github.com/1153683020/MoeKoe-Music-SearchTips-Stable/archive/07de9d5927d44edc8e8671ce0c15ce83ec553a09.zip) |
| <img src="https://raw.githubusercontent.com/z2oop/moekoe-theme-customizer/961a60b2043436c8885ee9d8e9554f5749b4a510/icons/icon.png" alt="MoeKoe Theme Customizer" width="64" height="64"> | [moekoe-theme-customizer](https://github.com/MoeKoeMusic/MoeKoeMusic-Plugins/issues/170) | [MoeKoe Theme Customizer](https://github.com/z2oop/moekoe-theme-customizer) | 个性化主题定制：自定义主色调 RGB、背景图与透明度、界面阴影增强 | 1.0.0 | 🟢 | [z2oop](https://github.com/z2oop) | [下载](https://github.com/z2oop/moekoe-theme-customizer/archive/961a60b2043436c8885ee9d8e9554f5749b4a510.zip) |
| <img src="https://raw.githubusercontent.com/MoeKoeMusic/apple-music-theme/79b15fdc82c61f7c7e81c14521e385e2acd296a5/logo.png" alt="Apple Music 主题" width="64" height="64"> | [apple-music-theme](https://github.com/MoeKoeMusic/MoeKoeMusic-Plugins/issues/168) | [Apple Music 主题](https://github.com/MoeKoeMusic/apple-music-theme) | 将 MoeKoe Music 调整为 Apple Music 风格的侧边栏、毛玻璃内容区与悬浮播放器布局主题。 | 1.1.8 | 🟢 | [iAJue](https://github.com/iAJue) | [下载](https://github.com/MoeKoeMusic/apple-music-theme/archive/79b15fdc82c61f7c7e81c14521e385e2acd296a5.zip) |
| <img src="https://raw.githubusercontent.com/z2oop/MoeKoeMusic_mod_lyspeed/b6b2f7dc2308b496a3c2d0ed3b6fb8d038df5f5e/icons/icon16.png" alt="MoeKoe 歌词同步调节" width="64" height="64"> | [moekoe-lyrics-sync](https://github.com/MoeKoeMusic/MoeKoeMusic-Plugins/issues/166) | [MoeKoe 歌词同步调节](https://github.com/z2oop/MoeKoeMusic_mod_lyspeed) | 实时调整歌词显示延迟，实现音画同步。正值让歌词延后，负值让歌词提前。 | 1.1.0 | 🟢 | [z2oop](https://github.com/z2oop) | [下载](https://github.com/z2oop/MoeKoeMusic_mod_lyspeed/archive/b6b2f7dc2308b496a3c2d0ed3b6fb8d038df5f5e.zip) |
| <img src="https://raw.githubusercontent.com/qiuyue123-star/moekoe-click-particle-effect/3959d28db72f25bf259ff7a837950f2a049084ad/icons/icon16.png" alt="全局鼠标点击特效" width="64" height="64"> | [moekoe-click-particle-effect](https://github.com/MoeKoeMusic/MoeKoeMusic-Plugins/issues/161) | [全局鼠标点击特效](https://github.com/qiuyue123-star/moekoe-click-particle-effect) | 为MoeKoeMusic提供全局鼠标点击粒子特效插件，支持渐变紫粒子、粉白蝴蝶结、水滴、不同颜色音符、小柑橘、水花、渐变橙粒子、小鱼干、糖果发卡、泡泡十种点击动画，可自由开关切换效果 | 1.1.3 | 🟢 | [qiuyue123-star](https://github.com/qiuyue123-star) | [下载](https://github.com/qiuyue123-star/moekoe-click-particle-effect/archive/3959d28db72f25bf259ff7a837950f2a049084ad.zip) |
| <img src="https://raw.githubusercontent.com/qiuyue123-star/global-video-bg-plugin/82aff6d348cea7e0292213442958ea0f20f35aa7/icons/icon16.png" alt="全局自定义动态背景" width="64" height="64"> | [global-video-bg-plugin](https://github.com/MoeKoeMusic/MoeKoeMusic-Plugins/issues/157) | [全局自定义动态背景](https://github.com/qiuyue123-star/global-video-bg-plugin) | 为MoeKoeMusic提供独立全局视频动态背景，无需其他背景插件打底，最大支持300MB视频永久存储，支持透明度调节，与其他背景类插件互斥不可同时运行，自带可拖动悬浮球沉浸式预览！(注：低配电脑可能用起来略微卡顿)！ | 1.1.3 | 🟢 | [qiuyue123-star](https://github.com/qiuyue123-star) | [下载](https://github.com/qiuyue123-star/global-video-bg-plugin/archive/82aff6d348cea7e0292213442958ea0f20f35aa7.zip) |
| - | [moekoe-smart-artist-search](https://github.com/MoeKoeMusic/MoeKoeMusic-Plugins/issues/154) | [MoeKoe Smart Artist Search](https://github.com/7832782/moekoe-smart-artist-search) | 点击歌手名时，自动按顿号分割多位歌手并弹出列表选择，解决联合搜索不精确的问题。 | 1.0.0 | 🟢 | [7832782](https://github.com/7832782) | [下载](https://github.com/7832782/moekoe-smart-artist-search/archive/7d4b12d5044b302d644eb256c9b895ceef2b7574.zip) |
| <img src="https://raw.githubusercontent.com/MoeKoeMusic/custom-app-background-plugin/3760b27c32856c1a14b39bec6086e0ffe717faff/icons/icon16.png" alt="自定义背景图" width="64" height="64"> | [custom-app-background](https://github.com/MoeKoeMusic/MoeKoeMusic-Plugins/issues/125) | [自定义背景图](https://github.com/MoeKoeMusic/custom-app-background-plugin) | 为MoeKoe Music提供自定义背景图能力，支持透明度调节。 | 1.0.1 | 🟢 | [iAJue](https://github.com/iAJue) | [下载](https://github.com/MoeKoeMusic/custom-app-background-plugin/archive/3760b27c32856c1a14b39bec6086e0ffe717faff.zip) |
| <img src="https://raw.githubusercontent.com/LateDreamXD/moekoe-latelib/v0.1.0/public/icon.png" alt="LateLib" width="64" height="64"> | [late-lib](https://github.com/MoeKoeMusic/MoeKoeMusic-Plugins/issues/123) | [LateLib](https://github.com/LateDreamXD/moekoe-latelib) | LateDream's library for moekoe music plugins | 0.1.0 | 🟢 | [LateDreamXD](https://github.com/LateDreamXD) | [下载](https://github.com/LateDreamXD/moekoe-latelib/releases/download/v0.1.0/latelib-v0.1.0.zip) |
| <img src="https://raw.githubusercontent.com/RTuioi/MoeKoe-EQ-Plugin/d3e67d3ea8cc1add48d6081f86d913f2402ab3fb/icons/icon16.png" alt="31段均衡器音效插件" width="64" height="64"> | [moekoe-equalizer](https://github.com/MoeKoeMusic/MoeKoeMusic-Plugins/issues/120) | [31段均衡器音效插件](https://github.com/RTuioi/MoeKoe-EQ-Plugin) | 31段均衡器插件-为MoeKoeMusic提供音频处理-（首次安装-请点击托盘-MoeKoeMusic-再点击重启应用-重启完成之后即可正常使用） | 2.1.1 | 🟢 | [RTuioi](https://github.com/RTuioi) | [下载](https://github.com/RTuioi/MoeKoe-EQ-Plugin/archive/d3e67d3ea8cc1add48d6081f86d913f2402ab3fb.zip) |
| <img src="https://raw.githubusercontent.com/RTuioi/MoeKoeMusic-like-indicator-plugin/1547067e44e5cfc93648b778b1d7def23354b1ee/icons/icon16.png" alt="歌曲收藏状态指示器" width="64" height="64"> | [like-indicator-plugin](https://github.com/MoeKoeMusic/MoeKoeMusic-Plugins/issues/119) | [歌曲收藏状态指示器](https://github.com/RTuioi/MoeKoeMusic-like-indicator-plugin) | 为底部播放栏和全屏歌词界面,添加已收藏歌曲的,收藏红心状态反馈，让已收藏的歌曲红心状态不再是灰色。其他说明：刚搓出来只测试了,我的歌单、收藏歌单、首页推荐的歌单、搜索界面、排行榜、歌手页，私人推荐暂时无法测试。如使用插件出现问题，欢迎反馈，请说明是哪首歌曲且需带上日志。 | 1.0.0 | 🟢 | [RTuioi](https://github.com/RTuioi) | [下载](https://github.com/RTuioi/MoeKoeMusic-like-indicator-plugin/archive/1547067e44e5cfc93648b778b1d7def23354b1ee.zip) |
| <img src="https://raw.githubusercontent.com/BB-CHICKEN/Small-Audio-Info/ee130c7dec99dfc38739a4ea6fa05b9f5a996d06/icons.jpg" alt="MoeKoe Music 音乐信息显示插件" width="64" height="64"> | [Small-Audio-Info](https://github.com/MoeKoeMusic/MoeKoeMusic-Plugins/issues/114) | [MoeKoe Music 音乐信息显示插件](https://github.com/BB-CHICKEN/Small-Audio-Info) | 在播放器右侧显示当前歌曲的文件大小和音频采样率 | 1.5.0 | 🟢 | [BB-CHICKEN](https://github.com/BB-CHICKEN) | [下载](https://github.com/BB-CHICKEN/Small-Audio-Info/archive/ee130c7dec99dfc38739a4ea6fa05b9f5a996d06.zip) |
| <img src="https://raw.githubusercontent.com/BB-CHICKEN/MoeKoe-Music-Total-Play-Time/2e41d8cab09385b2e8650d012935938a86f097f1/icons.jpg" alt="MoeKoe Music 累计听歌时长插件" width="64" height="64"> | [Total-Play-time](https://github.com/MoeKoeMusic/MoeKoeMusic-Plugins/issues/113) | [MoeKoe Music 累计听歌时长插件](https://github.com/BB-CHICKEN/MoeKoe-Music-Total-Play-Time) | 在你的个人主页右下角显示累计听歌时长 | 2.3.0 | 🟢 | [BB-CHICKEN](https://github.com/BB-CHICKEN) | [下载](https://github.com/BB-CHICKEN/MoeKoe-Music-Total-Play-Time/archive/2e41d8cab09385b2e8650d012935938a86f097f1.zip) |
| <img src="https://raw.githubusercontent.com/MoeKoeMusic/moekoe-comments-panel/aef8c14d81163fc7370177e58abea8d09317ff4f/icons/icon128.png" alt="MoeKoe 评论面板" width="64" height="64"> | [moekoe-comments-panel](https://github.com/MoeKoeMusic/MoeKoeMusic-Plugins/issues/109) | [MoeKoe 评论面板](https://github.com/MoeKoeMusic/moekoe-comments-panel) | 为 MoeKoe Music 增加歌单/专辑评论区。 | 1.1.0 | 🟢 | [iAJue](https://github.com/iAJue) | [下载](https://github.com/MoeKoeMusic/moekoe-comments-panel/archive/aef8c14d81163fc7370177e58abea8d09317ff4f.zip) |
| <img src="https://raw.githubusercontent.com/MoeKoeMusic/moekoe-desktop-carousel/d8cdeda8ed8b9290c50697f78f95006c5731882b/icons/icon128.png" alt="MoeKoe 桌面封面轮播" width="64" height="64"> | [moekoe-desktop-carousel](https://github.com/MoeKoeMusic/MoeKoeMusic-Plugins/issues/107) | [MoeKoe 桌面封面轮播](https://github.com/MoeKoeMusic/moekoe-desktop-carousel) | 一个 MoeKoe Music Windows桌面封面轮播插件。 | 1.0.1 | 🟢 | [iAJue](https://github.com/iAJue) | [下载](https://github.com/MoeKoeMusic/moekoe-desktop-carousel/archive/d8cdeda8ed8b9290c50697f78f95006c5731882b.zip) |
| <img src="https://raw.githubusercontent.com/LateDreamXD/moekoe-blue_archive-theme/v0.3.0/public/assets/icon.png" alt="蔚蓝档案主题" width="64" height="64"> | [blue_archive-theme](https://github.com/MoeKoeMusic/MoeKoeMusic-Plugins/issues/97) | [蔚蓝档案主题](https://github.com/LateDreamXD/moekoe-blue_archive-theme) | The sky blue archive✨ | 0.3.0 | 🟢 | [LateDreamXD](https://github.com/LateDreamXD) | [下载](https://github.com/LateDreamXD/moekoe-blue_archive-theme/releases/download/v0.3.0/ba-theme-v0.3.0.zip) |
| <img src="https://raw.githubusercontent.com/MoeKoeMusic/moekoe-lyric-desktop/f4b755b034e3797efa901d3e459909a6093b918b/icons/icon128.png" alt="MoeKoe 桌面歌词(Windows)" width="64" height="64"> | [moekoe-lyric-desktop](https://github.com/MoeKoeMusic/MoeKoeMusic-Plugins/issues/92) | [MoeKoe 桌面歌词(Windows)](https://github.com/MoeKoeMusic/moekoe-lyric-desktop) | 一个MoeKoe Music的Windows第三方桌面歌词程序插件. | 1.0.0 | 🟢 | [iAJue](https://github.com/iAJue) | [下载](https://github.com/MoeKoeMusic/moekoe-lyric-desktop/archive/f4b755b034e3797efa901d3e459909a6093b918b.zip) |
| <img src="https://raw.githubusercontent.com/RTuioi/MoeKoeMusic-audio-effect-plugin/526f2aac7912d18242446d2e19f3ae03cd74f122/icon-48.png" alt="在线音效插件" width="64" height="64"> | [audio-effect-plugin](https://github.com/MoeKoeMusic/MoeKoeMusic-Plugins/issues/73) | [在线音效插件](https://github.com/RTuioi/MoeKoeMusic-audio-effect-plugin) | 为播放器添加在线音效功能-音效- \|钢琴 \| 乐器 \| 尤克里里 \| 唢呐 \| DJ \| 伴奏 \| - 其他设置-高潮模式（只播放原曲高潮部分） | 1.0.2 | 🟢 | [RTuioi](https://github.com/RTuioi) | [下载](https://github.com/RTuioi/MoeKoeMusic-audio-effect-plugin/archive/526f2aac7912d18242446d2e19f3ae03cd74f122.zip) |
| <img src="https://raw.githubusercontent.com/MoeKoeMusic/custom-background/b33565501f855b56bcb2b8dba034e6eaa4bda3d5/icons/icon16.png" alt="MoeKoe自定义背景插件V2" width="64" height="64"> | [custom-background](https://github.com/MoeKoeMusic/MoeKoeMusic-Plugins/issues/56) | [MoeKoe自定义背景插件V2](https://github.com/MoeKoeMusic/custom-background) | 为 MoeKoe Music自定义个人主页背景和歌单封面插件。 | 2.0.0 | 🟢 | [iAJue](https://github.com/iAJue) | [下载](https://github.com/MoeKoeMusic/custom-background/archive/b33565501f855b56bcb2b8dba034e6eaa4bda3d5.zip) |
| <img src="https://raw.githubusercontent.com/Elysium1314/MoeKoe-Music-Disable-Single-Song-Display/5bbb8996f468dbff3593e36d19e6593b012274f7/icons.jpg" alt="阻止“我喜欢听”下出现神秘单曲" width="64" height="64"> | [disable-single-song-display](https://github.com/MoeKoeMusic/MoeKoeMusic-Plugins/issues/39) | [阻止“我喜欢听”下出现神秘单曲](https://github.com/Elysium1314/MoeKoe-Music-Disable-Single-Song-Display) | 阻止“我喜欢听”下出现奇奇怪怪的单曲，如果你不想看见它们的话，试试这个吧！ | 1.0.0 | 🟢 | [Elysium1314](https://github.com/Elysium1314) | [下载](https://github.com/Elysium1314/MoeKoe-Music-Disable-Single-Song-Display/archive/5bbb8996f468dbff3593e36d19e6593b012274f7.zip) |
| <img src="https://raw.githubusercontent.com/zc217888/moekoe-lyrics-extractor/6d515519e481408673651605827a22ed2f93469e/icons/icon16.svg" alt="歌词提取器" width="64" height="64"> | [moekoe-lyrics-extractor](https://github.com/MoeKoeMusic/MoeKoeMusic-Plugins/issues/33) | [歌词提取器](https://github.com/zc217888/moekoe-lyrics-extractor) | 提取当前播放歌曲的歌词并保存为 TXT 文件，支持翻译歌词和时间戳 | 1.0.0 | 🟢 | [zc217888](https://github.com/zc217888) | [下载](https://github.com/zc217888/moekoe-lyrics-extractor/archive/6d515519e481408673651605827a22ed2f93469e.zip) |
| <img src="https://raw.githubusercontent.com/chenyang137/MoeKoeMusic-artist-plugin/aeb8e51cd531306d6275be226844880a0ed0f452/icon-48.png" alt="歌手写真轮播" width="64" height="64"> | [artist-plugin](https://github.com/MoeKoeMusic/MoeKoeMusic-Plugins/issues/26) | [歌手写真轮播](https://github.com/chenyang137/MoeKoeMusic-artist-plugin) | 为 MoeKoeMusic 播放器添加歌手写真轮播功能，在全屏歌词界面展示歌手写真背景图并自动轮播。 | 1.0.2 | 🟢 | [chenyang137](https://github.com/chenyang137) | [下载](https://github.com/chenyang137/MoeKoeMusic-artist-plugin/archive/aeb8e51cd531306d6275be226844880a0ed0f452.zip) |
<!-- PLUGIN_LIST_END -->
