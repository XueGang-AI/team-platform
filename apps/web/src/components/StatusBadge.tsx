import type { ComponentStatusValue } from '@team-platform/contracts';
import type { ProbeStatus } from '@/lib/api-health';

/**
 * 把探测态映射为可读的中文标签。
 */
export function statusLabel(status: ProbeStatus): string {
  switch (status) {
    case 'loading':
      return '检测中';
    case 'ok':
      return '正常';
    case 'degraded':
      return '降级';
    case 'down':
      return '不可用';
    case 'unreachable':
      return '不可达';
    default:
      return '未知';
  }
}

/**
 * 把探测态映射为无障碍友好的数据属性与样式类名。
 * 使用受限的语义色：正常绿、降级琥珀、不可用/不可达红、检测中灰。
 * 不使用渐变与发光，仅靠颜色与文字传达状态。
 */
export function statusTone(status: ProbeStatus): {
  'data-tone': string;
  className: string;
} {
  switch (status) {
    case 'ok':
      return { 'data-tone': 'ok', className: 'tone tone-ok' };
    case 'degraded':
      return { 'data-tone': 'degraded', className: 'tone tone-degraded' };
    case 'down':
    case 'unreachable':
      return { 'data-tone': 'down', className: 'tone tone-down' };
    case 'loading':
      return { 'data-tone': 'loading', className: 'tone tone-loading' };
    default:
      return { 'data-tone': 'unknown', className: 'tone tone-unknown' };
  }
}

/**
 * 状态徽章：纯展示组件，Server/Client 均可使用。
 */
export function StatusBadge({ status }: { status: ProbeStatus }) {
  const tone = statusTone(status);
  return (
    <span
      className={tone.className}
      data-tone={tone['data-tone']}
      role="img"
      aria-label={statusLabel(status)}
    >
      <span aria-hidden="true" className="dot" />
      {statusLabel(status)}
    </span>
  );
}

/**
 * 把契约级别的整体状态映射为页面顶部摘要文字。
 */
export function overallSummary(overall: ComponentStatusValue): {
  title: string;
  description: string;
} {
  switch (overall) {
    case 'ok':
      return {
        title: '平台基础设施运行正常',
        description: '所有依赖组件就绪，可进入下一阶段开发。',
      };
    case 'degraded':
      return {
        title: '平台基础设施处于降级状态',
        description: '部分依赖组件异常，但不影响当前工程骨架。',
      };
    case 'down':
    default:
      return {
        title: '平台基础设施不可用',
        description: 'API 或关键依赖不可达，请检查本地基础设施是否启动。',
      };
  }
}
