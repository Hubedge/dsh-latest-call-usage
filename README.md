# 最近调用用量 / Latest call usage

独立 DSH Web 插件。通过现有 conversation.composer.dock 插槽，在原 usage 旁增加一个同样紧凑的组件，不改动 DSH 文件，也不读写原组件的 DOM。

```text
[原有 usage]  [12.8K · 缓存命中75% · 缓存优度 90%]
```

点击打开详情，再次点击、点击外部或按 Esc 关闭。详情采用与原 usage 一致的单列“指标名＋数值”布局：缓存命中率、缓存优度、未缓存输入、缓存读取、缓存写入（有数据时）、输出。标题旁显示精确总 tokens。支持中英文与主题颜色，窄屏下浮层限制在视口内。

## 统计定义

- 显示最近一次已结束的 LLM 调用。正在进行的新请求不会影响显示，直到该请求结算；第一条结算前隐藏组件。
- 统计范围与现有 usage 一致，为当前会话主对话循环中的 LLM 请求；同 step 内的重试分别算调用。辅助的压缩、标题生成等内部请求不在该口径内。
- “已结束”按持久化的 assistant/message 或 assistant/attempt 结算记录判断，也包含失败或取消的请求；并不代表整个 turn 已结束。
- 每次请求只取该次最终用量样本，不累计同一个 step，也不将前后两次请求相加。
- 未缓存输入 = DSH 规范化 inputTokens；全部输入 = 未缓存输入 + 缓存读取 + 缓存写入。
- 总 tokens = 全部输入 + 输出，不再次累加 reasoningTokens。
- 缓存命中率 = 该次缓存读取 / 该次全部输入。
- 缓存优度 = 该次缓存读取 / 紧邻前一次调用的总 tokens。按实际百分比显示，允许超过 100%。
- 首次调用、相邻调用用量缺失或分母为零时，对应比率显示“—”；不跳过缺失调用去寻找更早的分母。供应商未报告用量时，token 数显示“—”，不是估算值。
- 百分比通常保留一位小数并去掉末尾的零；缓存命中接近但未达到 100% 时增加必要精度。
- 悬停浮层中的“缓存优度”可以查看具体分子、分母及算式。
- 服务端使用增量 session projection。前端只订阅最近结算结果，不轮询、不受历史分页影响；压缩替换不会重复计算历史调用。

## 安装与启用

开发时核对的 DSH 版本：0.2.2-rc.1。需要 sessionProjections 服务和 conversation.composer.dock 插槽。

克隆本仓库后，在项目目录执行（需要 Node.js 和 npm）：

```sh
cd dsh-latest-call-usage
npm ci
pwd
```

在 DSH 左侧 **插件 → 添加插件** 中填入 `pwd` 输出的项目绝对路径，安装后选择 **立即启用**。安装结果若提示需要重启，应重启 DSH 后再刷新页面。

项目名称为 **dsh-latest-call-usage**，安装包名为 **@local/dsh-latest-call-usage**，显示名称为 **最近调用用量 / Latest call usage**。本地链接安装后请保留该目录。

## 本地验证

```sh
npm ci
npm test
node --check client.js
npm pack --dry-run
```

测试覆盖最近调用替换、运行中保持、同 step 重试、相邻分母、缺失数据、零分母、超过 100%、缓存写入、取消/失败结算、压缩替换、去重及 JSON checkpoint 恢复。

## 许可证

[MIT](LICENSE)
