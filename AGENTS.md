# AGENTS.md

- 性能是第一优先级，性能最终的目标是 golang
- 尽可能兼容 js/ts 的语法和能力行为
- 独立、内聚的模块做成带专属名字的 class（如 `Hang`、`TypeTable`、`Infer`）。AST 分派表不必硬收成 class。详情见 `.cursor/rules/ts-module-class.mdc`
