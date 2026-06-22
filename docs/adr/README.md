# ADR 索引

> ADR（Architecture Decision Record）记录需要长期保留的架构决策。
> 每条 ADR 只记录一个决策，包含背景、决策、理由、影响与状态。
> 不为形式创建无价值 ADR；只有真正需要长期保留的决策才记录。

## 格式

每条 ADR 包含：

- **状态**：proposed / accepted / superseded / deprecated
- **背景**：为什么需要做这个决策
- **决策**：最终选择
- **理由**：为什么选这个，替代方案为什么不选
- **影响**：带来的约束与后续成本
- **日期**：决策日期

## 索引

| 编号 | 标题 | 状态 |
|------|------|------|
| [0001](./0001-modular-monolith.md) | 采用模块化单体 | accepted |
| [0002](./0002-control-plane-data-plane.md) | 控制面与数据面分离 | accepted |
| [0003](./0003-observability-integration.md) | 可观测性集成而非重造 | accepted |
| [0004](./0004-database-schema-location.md) | Prisma schema 下沉到 apps/api | accepted |
