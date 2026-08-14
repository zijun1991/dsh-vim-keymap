# dsh-vim-keymap

[English](README.md) | **中文**

为 [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 的 Web GUI 提供 Vim 键位绑定，以独立的 out-of-tree Cordis 插件形式发布——不会对 deepseek-harness 本身做任何修改。

## 定位：vim 风格的键盘辅助，而不是 vim 的重新实现

这个插件的目标很克制：让输入框和会话树能用 vim 用户熟悉的键盘操作方式来驱动，而不是把 vim 整个复刻一遍。deepseek-harness 会话里真正干活的是 agent——写代码、改代码、搜索、执行，都是它在做，不是靠人一个字符一个字符地敲文本，而后者才是传统 vim 工作流的前提。如果为了追求功能完整，去实现寄存器、宏、标记、跳转列表、自定义 text object、完整的 ex 命令语言，那些投入换来的能力，用这个插件的人根本用不上。

所以判断要不要加一个新行为，标准很简单：它是不是真的解决了某个具体的键盘操作痛点。比如焦点已经离开输入框时 Shift+Esc 依然要能跳到 Session 模式，或者在别的监听都覆盖不到的时候，连按两次 Escape 能当作退回的手段，又或者用一个 `save` 命令替代点击宿主"Session log"按钮这个鼠标动作——这些都是在解决具体问题，而不是为了凑齐一套 `.vimrc` 级别的完整 vim 配置。Normal 模式的文本编辑能力，就是 `@replit/codemirror-vim` 开箱即用的那一套，没有做任何扩展；Command 模式的命令词表目前只有一个 `save`（详见下文"已知限制"），这正是上面这条原则的体现，不是没做完。

## 模式

```
Insert（默认状态，输入框）
  Esc            -> Normal
  Shift+Esc      -> Session（无论焦点在哪、当前是什么模式都能触发——见下文）
  Enter          -> 换行（这是插件主动实现的行为，见下文）
  Cmd/Alt+Enter  -> 发送消息（宿主原生行为，未改动；靠 Cmd/Alt 跟裸 Enter 区分）
  Esc Esc        -> （救援手段）不管当前是什么模式、焦点在哪，强制回到 Insert 并重新聚焦输入框

Normal（真正的 vim 文本编辑，仍在输入框内）
  j/k            -> 上下移动一行（真正按行移动，不是按可视换行移动）
  :              -> Command（normal 风格）
  i/a/o/...      -> Insert

Session（工作区/会话树导航，不是文本编辑）
  j/k            -> 移动高亮
  Enter          -> 在 workspace 行上是展开/折叠；在 session 或搜索结果行上，
                    是打开该项并直接回到 Insert（输入框重新聚焦）
  /              -> 聚焦宿主的会话搜索框
  :              -> Command（session 风格）
  Esc            -> 直接回到 Insert（输入框重新聚焦）

Command（一个全局悬浮输入框，两种视觉上可区分的风格）
  save           -> （仅 normal 风格）点击宿主自带的"Session log"下载按钮——
                    命令词表的其余部分仍只是面板外壳，见下文"已知限制"
```

右下角有一个不可交互的小徽标，内容是 `Vim Mode: <MODE>`，用来显示当前处于四种模式里的哪一种——这是唯一的视觉提示，宿主 UI 本身完全看不出 vim 状态。它的展示策略有三种：`'persistent'`（默认，一直显示）、`'on-change'`（切换模式后显示约 1.2 秒再隐藏）、`'hidden'`（不显示）。这个策略，以及 `enterNormal`/`enterSession` 这两个快捷键本身（默认分别是 `Escape` 和 `Shift+Escape`），都能在插件注册进 Settings → Plugins → Plugin configuration 的"Vim Keymap"卡片里修改，数据保存在 `localStorage`（不存进 Host 的设置文档，原因见下文"设置持久化"）。`enterSession` 是个全局快捷键，不要求输入框处于聚焦状态，详见下文。

Enter 和发送的这套约定，是插件主动做出来的，不是宿主默认就这样。在真实的 `dsh --profile web` 实例上验证过，宿主自己的 bubble 阶段处理器默认会把裸 Enter 当成"发送"，正好跟这个插件想要的约定相反。所以 `textarea-adapter.ts` 会拦截 Insert 模式下的裸 Enter，先调用 `preventDefault()`，再通过 `inputActions.setDraft()` 自己把 `'\n'` 插进去——原本想靠浏览器原生的换行行为就够了，结果试下来完全没用，因为这个监听器的上游某处已经对裸 Enter 调用过 `preventDefault()`。平台的发送组合键（Mac 上是 Cmd+Enter，其他平台是 Alt+Enter）完全不受影响，原样放行。

`enterSession`（默认 `Shift+Escape`）现在是 `RootOverlay.tsx` 里一个全局的 keydown 监听，不依赖焦点，跟绑在输入框自己身上的 `enterNormal` 不一样。原因很直接：进入 Normal 模式天然要求输入框处于聚焦状态，因为它的含义就是"用 vim 方式编辑这个文本框"；但跳到 Session 模式没有这个前提。这个逻辑以前是和 `enterNormal` 一起放在 `textarea-adapter.ts` 里的，结果焦点一旦离开输入框它就彻底失效了——这在真机上验证过——跟下面双击 Escape 救援要解决的其实是同一类问题。

为什么要做双击 Escape 救援（`RootOverlay.tsx`）？因为插件装的其他每一个 keydown 监听都只覆盖特定范围：Insert/Normal 靠的是输入框自己，Session 虽然是 document 级别的监听，但只有在 Session 模式下才生效。这样一来，只要浏览器焦点飘到了别处——点了宿主的某个按钮，或者干脆哪儿都没聚焦——就没有任何监听会响应 Escape，除了用鼠标点回输入框，没有别的办法能用键盘找回来。所以快速连按两次裸 Escape，不管当前是什么模式、焦点在哪儿都会生效，强制回到 Insert 并重新聚焦输入框。

Normal 模式的 `j`/`k` 现在能真正一行一行地移动了，这依赖那个影子 `EditorView` 真正接入渲染出来的文档。原因是 CodeMirror 算 `j`/`k` 的移动量，靠的是真实的像素级行高和行位置，而一个从没挂载到任何地方的 view，每一行的高度都会读成零。这个问题在真机上用真正的多行文本试过：结果不是一行一行移动，而是直接在文档第一行和最后一行之间跳来跳去。现在 `engine.ts` 的构造函数会把这个 view 挂进一个 `aria-hidden`、`visibility: hidden`、放在屏幕外的容器 div 里——真正参与布局计算，但用户看不见，tab 键切不到，读屏软件也读不到——而不是让它彻底脱离文档。

进入 Normal 模式的时候，光标还会像真实 vim 一样被校正一次：打字打到一半按下 Esc 是最常见的场景，这时候光标其实停在行末字符的后一位，校正会把它拉回到那个字符本身，而不是留在一个只有 Insert 模式才允许出现的位置——留在那儿的话，往右的移动动作就再也生效不了。这个校正不是白来的，真机上验证过：`@replit/codemirror-vim` 只有在真正处理一次"离开 insert 模式"的按键时才会做这个校正，而 `syncFromHost` 从来不会触发这样的按键，它是直接用 `EditorState.create` 把文档和选区换掉的。所以这个校正得由 `engine.ts` 里的 `clampToNormalModeCaret` 显式去做，再由 `textarea-adapter.ts` 把校正后的位置读回宿主输入框——其余每一次基于 onChange 的编辑都会自动完成这一步，唯独这一步不会。

## 为什么这个插件从不改动 deepseek-harness

每一个接入点要么是现成的通用扩展点，要么是基于已经公开、已经渲染出来的状态驱动的：

- **Normal 模式**能拿到输入框的 `useInput`/`inputActions`，靠的是往 `conversation.session.header.actions`（`ui-conversation` 为第三方 header 按钮声明的 `list` 类型 slot）注册一个 headless、不渲染任何内容的组件。它从不注册进 `conversation.composer.bar`——那是 InputBar 自己独占的 slot——也不会 import InputBar 的内部实现。真正的文本编辑，跑在一个 headless 的 `@codemirror/view` `EditorView` 上（配合 `@replit/codemirror-vim`），从不挂载到可见 DOM；编辑结果通过 `inputActions.setDraft()` 流回去，和 InputBar 自己用的公开写入路径完全一样。
- **Session 模式**从不 import `ui-workspace`，也不碰它的 view store，而是直接从渲染出来的、带无障碍属性的 DOM（`role="tree"`/`role="treeitem"`/`aria-expanded`）里读工作区树，靠在行元素上派发真实的 `click` 事件来完成折叠、展开和打开行——跟鼠标用户做的事情一模一样。`ui-workspace` 自己的内部 store 完全没有被碰过。
- **Command 模式**用 portal 挂到 `document.body` 上，整个插件的全局界面——Session 模式的 overlay、Command 面板、模式徽标——都注册进 `shell.overlay`，这正是 `ui-layout` 为这个用途专门文档化出来的、可叠加的全局 overlay slot。
- 这两个动态声明的 slot——`conversation.session.header.actions`（作用域 `session`）和 `shell.overlay`（作用域 `root`）——都是通过 `ctx.slots.inject(key, factory)` 接入的，不是直接调用 `ctx.slots.register(...)`。原因是在真机上试过：直接调用会跟拥有该 slot 的插件自己的声明抢时间，抛出 `slot "..." is not declared`。启动依赖图里每个包的 `inject` 元数据只是给 preflight 展示和 HMR 比对用的信息，并不保证真正的激活顺序（详见 deepseek-harness 里 `packages/client/modules/src/client/manifest.ts` 对 `WebBootEntry.inject` 的说明）。`ctx.slots.inject` 正是 `ui-jobs`/`ui-subagent`/`ui-agent-preset` 对同一个 slot 已经在用的写法。

## 设置持久化：用 `localStorage`，而不是 Host 的设置文档

"Vim Keymap" 卡片（`settings.plugin.item`，由 `@deepseek-ai/dsh-client-ui-settings-plugins` 声明）是一个真正公开的 list slot，用跟上面两个 slot 一样的 `ctx.slots.inject` 方式注册进去，完全没问题。但想给它的字段（模式徽标展示策略、`enterNormal`/`enterSession` 快捷键）做一个真正的 `ctx.settings` 注册，就行不通了：真机上试过，通过注册的命名空间写入会直接失败，报错是：

```json
{"error":{"code":"settings-not-exposed","message":"settings namespace \"dsh-vim-keymap\" is not exposed to configuration clients"}}
```

根因出在 `packages/host/apiproxy/src/api-proxy.ts` 的 `WEB_SETTINGS_NAMESPACES`——一份硬编码的白名单，Host 网关每次读写设置都会先查它，跟拥有这份设置的插件有没有注册过 schema 没有任何关系。那个文件自己的注释也承认这是个已知缺口：本来应该让每个插件都能通过自己的 `settings.register()` 调用去扩展这份白名单，不用改动那个包本身，但这件事被标成了还没做完的"deferred work"。上游没把这件事做完之前，插件就没有任何可用的扩展点；而直接去改那份白名单，等于是在改 deepseek-harness 本身——这正是这个插件绝对不做的事。

所以 `src/client/settings/local-store.ts` 干脆改成持久化到 `localStorage`：纯粹、同步，不用跟 Host 打一次来回，也不受白名单限制。卡片上的文案也把这件事说明白了——"仅保存在此浏览器，不随账号同步。"——不去暗示一种它实际做不到的、基于 Host 文档的持久化。

这段代码原本接的是真正的 `SettingsScope`，那时候 `useSyncExternalStore(settings.subscribe, settings.getSnapshot)` 会直接抛出 `Cannot read properties of undefined (reading 'store')`。原因是真实控制器的 `getSnapshot`/`subscribe` 是普通的原型方法，当作裸引用传出去，就会跟 `this` 脱钩。dev-harness 里那个由一堆闭包拼出来的 mock scope 完全不会暴露这个问题，因为它压根没有需要绑定的 `this`。这正是为什么 `LocalKeymapSettingsStore` 特意把 `getSnapshot`/`subscribe` 写成箭头函数形式的 class field，而不是普通方法——构造的时候绑定一次，之后随便怎么传都安全。

## 客户端 bundle 格式

`dsh-client-modules`（deepseek-harness 的浏览器插件加载器）请求的是 `/plugins/<id>/client.js`，而且要求这个文件包装成 `window.__ModuleLoader__.load({ id, factory: (require) => {...} })` 的形式。里面只有固定的一组 specifier（`react`、`@deepseek-ai/cordis`、`@deepseek-ai/dsh-client-ui-slots` 等）能通过 `require()` 解析，其余的东西都得打进 bundle。用来构建这种格式的预设（`packages/client/tsdown.client.ts`）是那个 monorepo 内部的东西，没有导出给第三方用，所以这里的 `tsdown.config.ts` 只能照着 deepseek-harness 自己公开发布的源码，把这套能观察到的接线约定——banner/footer 包装、externals 列表、把其余一切强制打进 bundle——重新实现一遍，而不是直接 import 它。

`package.json` 的 `exports` 映射里还必须列一条 `"./package.json": "./package.json"`，因为 `dsh-client-modules` 是靠 `require.resolve("<pkg>/package.json")` 去解析候选插件的 `dsh.client` 声明的——Node 的 `exports` 字段要是没有这一条，会直接拒绝这个子路径。resolver 的 catch 逻辑会把这种情况和"这根本不是一个 client 包"混为一谈，结果就是插件被启动依赖图接受了，却从来没被真正请求过，还不会报任何错。

## 已知限制 / 后续工作

- **Command 模式的命令词表目前只有一个：`save`（仅 normal 风格）。** 它做的事是点击宿主自带的"Session log"按钮——这是现有 UI 里最接近"保存这个会话"的操作，`InputActions`/`SessionInput` 里根本没有保存或导出相关的方法（见 `src/client/session/session-log-bridge.ts`）。因为这个按钮既没有 `aria-label`，CSS class 又是构建时生成的哈希值，只能靠它的可见文本来匹配。面板的其余部分还只是个空壳：portal 挂载、按风格区分的样式、提交/取消键。这是刻意收窄的范围，不是没做完（见上文"定位"一节）——session 风格的命令，或者更丰富的 normal 风格词表，都是"有具体需求才做"的事，不是朝着一套"完整"的 vim 命令集堆功能。
- **`focusSearch()` 现在能驱动真实的会话搜索输入框了**，这一点在真机上确认过：`ui-workspace` 的 `WorkspaceBrowser.tsx` 把它渲染成一个普通的、一直存在的 `<input type="text">`，没有能区分身份的 `aria-label`，class 也不稳定，而且默认是视觉上收起的状态（`opacity: 0`、`pointer-events: none`），得等旁边的展开按钮被点了才会打开。单纯调用 `.focus()` 什么都不会发生——这一点也是在真机上确认的，之前有一次因为遗留的点击操作，一度误判为"单靠 focus 就够了"。所以 `src/client/workspace/tree-bridge.ts` 会先点击那个展开按钮，再去聚焦输入框。展开按钮是靠结构关系找到的：它是这个输入框唯一带 `aria-expanded` 属性的兄弟节点，这种定位方式跟语言、构建版本都无关，比它那个中文的 `aria-label` 靠谱得多。屏幕上还有另一个 `<input type="text">`——重命名工作区弹窗的名称输入框——但它只有在那个弹窗的 `role="dialog"` 容器被挂载时才存在，这正是用来把两者区分开的依据。
- **`enterNormal`/`enterSession` 现在都能让用户自己改了**，改的地方是"Vim Keymap"设置卡片，背后靠一个小型的按键组合解析器（`src/key-combo.ts`），能把 `"Shift+Escape"` 这样的字符串跟真实的 `KeyboardEvent` 做匹配。原来跟它们放在一起的 `submit` 常量（在 `src/config.ts` 里）被直接删掉了，没有保留下来：这个插件从来不拦截宿主自己的发送快捷键（见上面模式图里的"未改动"），所以给它做设置从一开始就不可能有任何作用。`src/config.ts` 本身也是没人 import 过的死代码，等 `src/settings.ts` 变成这些默认值真正的、可以实时编辑的来源之后，就顺手删掉了。
- **`@deepseek-ai/dsh-client-*` 的 `latest` 这个 npm dist-tag 目前是坏的**：`0.0.1-rc.1` 依赖 `@deepseek-ai/dsh-compact`、`@deepseek-ai/dsh-client-ui-slash`、`@deepseek-ai/dsh-type-meta` 这几个包，但它们都没有发布过。这个仓库改用了 `next` 这个 dist-tag（`0.1.0-rc.6`），能正常解析。这个问题值得反馈给上游。

## 开发

```sh
pnpm install
pnpm run typecheck
pnpm test
pnpm run build
```

### 快速本地迭代：dev-harness

`dev-harness/` 是一个用 Vite 起服务的页面，挂载的是真正构建出来的 `lib/` 产物（不是另外写的一份实现），配合模拟出来的、跟宿主真实结构一致的输入框和工作区树 DOM。它不属于发布出去的插件本体，详见 `dev-harness/README.md`。不想每次都启动 `dsh` 实例做快速迭代的话，用它就行：

```sh
pnpm run build   # dev-harness 引用的是 lib/，不是 src/
pnpm run dev:harness
```

### 在真实 dsh 上验证

这个插件已经在一个真实运行的 `dsh --profile web` 实例上跑过——四种模式和设置卡片都在真实浏览器里确认过，不是靠猜的。想照着做的话：

1. `pnpm run build`（必须跑到 `tsdown` 这一步——单独的 `tsc` 产物没法当 client bundle 用，见上文"客户端 bundle 格式"）。
2. 选一个 `dsh` home——用临时目录比用你真实的 `~/.dsh` 更安全（`export DSH_HOME=/path/to/scratch`），然后跑一次 `dsh --profile web --help`，自动初始化 `$DSH_HOME/profiles/web/`。
3. 把这个包加进 `$DSH_HOME/profiles/web/package.json` 的 `dependencies` 里：`"dsh-vim-keymap": "link:/绝对路径/到这个仓库"`，然后在那个 profile 目录里跑 `pnpm install`。
4. 在 `$DSH_HOME/profiles/web/cordis.patch.yml` 里加一行：`- insert:\n    - id: dsh-vim-keymap\n      name: dsh-vim-keymap`。
5. `dsh --profile web`——整个过程都不需要对 deepseek-harness 本身做任何改动。
