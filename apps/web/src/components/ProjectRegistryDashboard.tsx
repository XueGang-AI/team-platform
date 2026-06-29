'use client';

import { FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import type {
  CreateProjectBody,
  GovernanceDashboardDTO,
  GovernanceRecordDTO,
  GovernanceRecordKind,
  ManifestApplyResult,
  ManifestValidationResult,
  ObservabilityLinkDTO,
  ObservabilitySignal,
  PagedResult,
  ProjectDTO,
  ProjectDetailDTO,
  ProjectMemberDTO,
  ProjectRole,
  ProjectStatus,
  ProjectType,
  ServiceCredentialDTO,
  ServiceCredentialWithTokenDTO,
  ServiceDTO,
  ServiceEndpointDTO,
  UserDTO,
} from '@team-platform/contracts';
import {
  ApiClientError,
  applyManifest,
  checkEndpoint,
  createCredential,
  createGovernanceRecord,
  createObservabilityLink,
  createProject,
  getGovernanceDashboard,
  getProject,
  listCredentials,
  listMembers,
  listObservabilityLinks,
  listProjects,
  login,
  revokeCredential,
  rotateCredential,
  upsertMember,
  validateManifest,
} from '@/lib/project-registry';
import type { ProbeStatus } from '@/lib/api-health';
import { StatusBadge } from '@/components/StatusBadge';
import { StatusDashboard } from '@/components/StatusDashboard';
import {
  ArrowRight,
  Bell,
  ClipboardCheck,
  Database,
  ExternalLink,
  FileCode2,
  GitBranch,
  Globe2,
  HeartPulse,
  KeyRound,
  LineChart,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  Server,
  UploadCloud,
  Users,
  WalletCards,
} from 'lucide-react';

const projectTypes: ProjectType[] = [
  'WEB_APPLICATION',
  'API_SERVICE',
  'AI_APPLICATION',
  'DATA_SERVICE',
  'INTERNAL_TOOL',
  'OTHER',
];
const projectStatuses: ProjectStatus[] = ['ACTIVE', 'MAINTENANCE', 'ARCHIVED'];
const projectRoles: ProjectRole[] = ['OWNER', 'MAINTAINER', 'DEVELOPER', 'VIEWER'];
const governanceKinds: GovernanceRecordKind[] = [
  'ALERT_RULE',
  'CONFIGURATION',
  'DEPLOYMENT',
  'TASK',
  'FEATURE_FLAG',
  'MODEL_ROUTE',
  'COST_RECORD',
  'PROMPT_VERSION',
];
const observabilitySignals: ObservabilitySignal[] = ['LOGS', 'METRICS', 'TRACES', 'DASHBOARD'];

const defaultManifest = `apiVersion: team-platform.io/v1alpha1
kind: Project

metadata:
  slug: manjv-studio
  name: Manjv Studio
  labels:
    domain: ai-video
    language: typescript
    runtime: nextjs

spec:
  type: AI_APPLICATION
  owner:
    name: XueGang-AI
    email: example@example.com
  repository:
    url: file:///Users/xuegang/Desktop/My%20Project/manjv-studio
  services:
    - slug: web
      name: Manjv Studio Web
      type: WEB
    - slug: api
      name: Manjv Studio API Routes
      type: API
    - slug: worker
      name: Manjv Studio Worker
      type: WORKER
    - slug: model-adapters
      name: Model Adapters
      type: MODEL_SERVICE
    - slug: task-events
      name: Task Events
      type: WORKER
  environments:
    - slug: local
      name: 本地开发
    - slug: docker
      name: Docker 演示
  endpoints:
    - service: web
      environment: local
      baseUrl: http://localhost:3100
      healthCheck:
        enabled: true
        path: /
    - service: api
      environment: local
      baseUrl: http://localhost:3100
      healthCheck:
        enabled: true
        path: /api/health
`;

type LoadState = 'idle' | 'loading' | 'ready' | 'error';
type WorkspaceView =
  | 'overview'
  | 'catalog'
  | 'services'
  | 'health'
  | 'governance'
  | 'release'
  | 'cost'
  | 'access'
  | 'integration'
  | 'observability';
type OperationNotice = { tone: 'success' | 'info'; message: string };

interface ProjectRegistryDashboardProps {
  apiBaseUrl: string;
}

interface DashboardSummary {
  totalProjects: number;
  activeProjects: number;
  serviceCount: number;
  environmentCount: number;
  endpointCount: number;
  healthyEndpointCount: number;
  downEndpointCount: number;
  activeAlerts: number;
  monthlyCostCents: number;
  credentials: number;
  members: number;
}

interface ProjectFormState {
  slug: string;
  name: string;
  type: ProjectType;
  ownerName: string;
  ownerEmail: string;
  repositoryUrl: string;
  documentationUrl: string;
  tags: string;
}

interface CatalogDisplayProject {
  id: string;
  slug: string;
  name: string;
  type: string;
  status: ProjectStatus;
  ownerName: string;
  ownerEmail: string | null;
  tags: string[];
  updatedAt: string;
  health: string;
  serviceCount: number | null;
}

const workspaceByHash: Record<string, WorkspaceView> = {
  overview: 'overview',
  catalog: 'catalog',
  services: 'services',
  health: 'health',
  governance: 'governance',
  release: 'release',
  cost: 'cost',
  access: 'access',
  integration: 'integration',
  observability: 'observability',
};

const workspaceCopy: Record<
  WorkspaceView,
  { label: string; eyebrow: string; description: string }
> = {
  overview: {
    label: '项目治理工作台',
    eyebrow: 'Control Center',
    description: '统一治理、可观测、可信赖的内部开发者平台',
  },
  catalog: {
    label: '项目目录',
    eyebrow: 'Service Catalog',
    description: '用表格、筛选和详情检查器管理所有项目，不再跳回首页。',
  },
  services: {
    label: '服务与环境',
    eyebrow: 'Runtime Topology',
    description: '按服务、环境、端点健康和凭证状态查看当前项目运行面。',
  },
  health: {
    label: '健康状态',
    eyebrow: 'Health Command',
    description: '聚合系统基础设施和项目端点检测，定位异常端点与依赖状态。',
  },
  governance: {
    label: '告警治理',
    eyebrow: 'Alert Governance',
    description: '治理告警规则、配置、模型路由和处理队列，降低噪音和遗漏。',
  },
  release: {
    label: '发布记录',
    eyebrow: 'Release Train',
    description: '按环境泳道追踪发布、回滚、发布后健康检查和审计记录。',
  },
  cost: {
    label: '成本',
    eyebrow: 'FinOps Lens',
    description: '按服务和环境归因成本，即使本地为零也保留预算、异常和优化结构。',
  },
  access: {
    label: '权限凭证',
    eyebrow: 'Access Control',
    description: '管理成员角色、服务凭证、轮换状态和安全治理建议。',
  },
  integration: {
    label: '接入',
    eyebrow: 'Onboarding',
    description: '通过表单和 Manifest 接入本地项目，默认对齐 Manjv Studio 的 3100 地址。',
  },
  observability: {
    label: '观测看板',
    eyebrow: 'Observability',
    description: '把项目真实观测入口和采集链路映射为可操作入口。',
  },
};

function emptyForm(): ProjectFormState {
  return {
    slug: '',
    name: '',
    type: 'AI_APPLICATION',
    ownerName: '',
    ownerEmail: '',
    repositoryUrl: '',
    documentationUrl: '',
    tags: '',
  };
}

function toCatalogDisplayProject(
  project: ProjectDTO,
  selected?: ProjectDetailDTO | null,
): CatalogDisplayProject {
  const health = selected?.slug === project.slug ? projectHealth(selected) : null;
  return {
    id: project.id,
    slug: project.slug,
    name: project.name,
    type: project.type,
    status: project.status,
    ownerName: project.ownerName,
    ownerEmail: project.ownerEmail,
    tags: project.tags,
    updatedAt: project.updatedAt,
    health: health ? `${health.healthy}/${health.total}` : '选择后检测',
    serviceCount: selected?.slug === project.slug ? selected.services.length : null,
  };
}

function catalogDisplayRows(
  projects: PagedResult<ProjectDTO> | null,
  selected: ProjectDetailDTO | null,
  search: string,
  status: ProjectStatus | '',
  includeArchived: boolean,
): CatalogDisplayProject[] {
  const rows = (projects?.items ?? []).map((project) => toCatalogDisplayProject(project, selected));
  const normalizedSearch = search.trim().toLowerCase();
  return rows.filter((project) => {
    if (status && project.status !== status) return false;
    if (!includeArchived && project.status === 'ARCHIVED') return false;
    if (!normalizedSearch) return true;
    return [
      project.name,
      project.slug,
      project.ownerName,
      project.ownerEmail ?? '',
      project.type,
      ...project.tags,
    ]
      .join(' ')
      .toLowerCase()
      .includes(normalizedSearch);
  });
}

export function ProjectRegistryDashboard({ apiBaseUrl }: ProjectRegistryDashboardProps) {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceView>('overview');
  const [projects, setProjects] = useState<PagedResult<ProjectDTO> | null>(null);
  const [selected, setSelected] = useState<ProjectDetailDTO | null>(null);
  const [selectingSlug, setSelectingSlug] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ProjectStatus | ''>('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<OperationNotice | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [form, setForm] = useState<ProjectFormState>(emptyForm);
  const [manifest, setManifest] = useState(defaultManifest);
  const [manifestResult, setManifestResult] = useState<ManifestValidationResult | null>(null);
  const [applyResult, setApplyResult] = useState<ManifestApplyResult | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserDTO | null>(null);
  const [loginEmail, setLoginEmail] = useState('admin@example.com');
  const [loginName, setLoginName] = useState('Platform Admin');
  const [members, setMembers] = useState<ProjectMemberDTO[]>([]);
  const [credentials, setCredentials] = useState<ServiceCredentialDTO[]>([]);
  const [observabilityLinks, setObservabilityLinks] = useState<ObservabilityLinkDTO[]>([]);
  const [governanceDashboard, setGovernanceDashboard] = useState<GovernanceDashboardDTO | null>(
    null,
  );
  const [newCredential, setNewCredential] = useState<ServiceCredentialWithTokenDTO | null>(null);
  const [memberEmail, setMemberEmail] = useState('');
  const [memberName, setMemberName] = useState('');
  const [memberRole, setMemberRole] = useState<ProjectRole>('VIEWER');
  const [credentialName, setCredentialName] = useState('');
  const [credentialServiceId, setCredentialServiceId] = useState('');
  const [credentialEnvironmentSlug, setCredentialEnvironmentSlug] = useState('');
  const [observabilityTitle, setObservabilityTitle] = useState('');
  const [observabilityUrl, setObservabilityUrl] = useState('');
  const [observabilitySignal, setObservabilitySignal] = useState<ObservabilitySignal>('DASHBOARD');
  const [governanceKind, setGovernanceKind] = useState<GovernanceRecordKind>('ALERT_RULE');
  const [governanceName, setGovernanceName] = useState('');
  const [governanceStatus, setGovernanceStatus] = useState('ACTIVE');

  const query = useMemo(
    () => ({ page: 1, pageSize: 50, search, status: status || undefined, includeArchived }),
    [includeArchived, search, status],
  );
  const governance = governanceDashboard ?? emptyGovernanceDashboard();
  const summary = useMemo<DashboardSummary>(() => {
    const projectItems = projects?.items ?? [];
    const endpoints = selected?.endpoints ?? [];
    const healthyEndpoints = endpoints.filter(
      (endpoint) => endpoint.lastHealthStatus === 'HEALTHY',
    );
    const downEndpoints = endpoints.filter((endpoint) => endpoint.lastHealthStatus === 'UNHEALTHY');
    return {
      totalProjects: projects?.total ?? 0,
      activeProjects: projectItems.filter((project) => project.status === 'ACTIVE').length,
      serviceCount: selected?.services.length ?? 0,
      environmentCount: selected?.environments.length ?? 0,
      endpointCount: endpoints.length,
      healthyEndpointCount: healthyEndpoints.length,
      downEndpointCount: downEndpoints.length,
      activeAlerts: governance.summary.activeAlerts,
      monthlyCostCents: governance.summary.monthlyCostCents,
      credentials: credentials.length,
      members: members.length,
    };
  }, [credentials.length, governance.summary, members.length, projects, selected]);

  const isBusy = (action: string) => busyAction === action;
  const hasSession = Boolean(token);

  async function runOperation<T>(
    action: string,
    operation: () => Promise<T>,
    successMessage?: string | ((result: T) => string),
    onError?: () => Promise<void>,
  ): Promise<T | undefined> {
    setBusyAction(action);
    setError(null);
    setNotice(null);
    try {
      const result = await operation();
      if (successMessage) {
        setNotice({
          tone: 'success',
          message: typeof successMessage === 'function' ? successMessage(result) : successMessage,
        });
      }
      return result;
    } catch (err) {
      handleError(err);
      if (onError) {
        await onError();
      }
      return undefined;
    } finally {
      setBusyAction((current) => (current === action ? null : current));
    }
  }

  async function refreshProjects(nextSelectedSlug?: string) {
    setLoadState('loading');
    setError(null);
    try {
      if (!token) {
        setProjects(null);
        setSelected(null);
        setLoadState('idle');
        return;
      }
      const result = await listProjects(apiBaseUrl, query, token);
      setProjects(result);
      const slug = nextSelectedSlug ?? selected?.slug ?? result.items[0]?.slug;
      if (slug) {
        await selectProject(slug);
      } else {
        setSelected(null);
      }
      setLoadState('ready');
    } catch (err) {
      setLoadState('error');
      handleError(err);
    }
  }

  async function selectProject(slug: string) {
    setSelectingSlug(slug);
    setError(null);
    try {
      const detail = await getProject(apiBaseUrl, slug, token);
      setSelected(detail);
      if (token) {
        const [projectMembers, projectCredentials, links, nextGovernance] = await Promise.all([
          listMembers(apiBaseUrl, slug, token),
          listCredentials(apiBaseUrl, slug, token),
          listObservabilityLinks(apiBaseUrl, slug, token),
          getGovernanceDashboard(apiBaseUrl, slug, token),
        ]);
        setMembers(projectMembers);
        setCredentials(projectCredentials);
        setObservabilityLinks(links);
        setGovernanceDashboard(nextGovernance);
      }
    } catch (err) {
      handleError(err);
    } finally {
      setSelectingSlug(null);
    }
  }

  async function onManualRefresh() {
    await runOperation('refreshProjects', () => refreshProjects(), '工作台数据已刷新');
  }

  async function onCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      setError('请先登录后再创建项目。');
      return;
    }
    const body: CreateProjectBody = {
      slug: form.slug.trim(),
      name: form.name.trim(),
      type: form.type,
      ownerName: form.ownerName.trim(),
      ...(form.ownerEmail.trim() ? { ownerEmail: form.ownerEmail.trim() } : {}),
      ...(form.repositoryUrl.trim() ? { repositoryUrl: form.repositoryUrl.trim() } : {}),
      ...(form.documentationUrl.trim() ? { documentationUrl: form.documentationUrl.trim() } : {}),
      ...(form.tags.trim()
        ? {
            tags: form.tags
              .split(',')
              .map((tag) => tag.trim())
              .filter(Boolean),
          }
        : {}),
    };
    await runOperation(
      'createProject',
      async () => {
        const created = await createProject(apiBaseUrl, body, token);
        setForm(emptyForm());
        await refreshProjects(created.slug);
        return created;
      },
      (created) => `已创建项目 ${created.slug}`,
    );
  }

  async function onValidateManifest() {
    await runOperation(
      'validateManifest',
      async () => {
        setApplyResult(null);
        const result = await validateManifest(apiBaseUrl, manifest);
        setManifestResult(result);
        return result;
      },
      (result) => (result.valid ? 'Manifest 校验通过' : 'Manifest 校验完成，存在错误'),
    );
  }

  async function onApplyManifest() {
    if (!token) {
      setError('请先登录后再应用 Manifest。');
      return;
    }
    await runOperation(
      'applyManifest',
      async () => {
        const result = await applyManifest(apiBaseUrl, manifest, token);
        setApplyResult(result);
        await refreshProjects(result.projectSlug);
        return result;
      },
      (result) => `已应用 Manifest：${result.projectSlug}`,
    );
  }

  async function onCheckEndpoint(endpointId: string) {
    if (!selected) return;
    await runOperation(
      `checkEndpoint:${endpointId}`,
      async () => {
        await checkEndpoint(apiBaseUrl, selected.slug, endpointId, token);
        await selectProject(selected.slug);
      },
      '端点检测已完成',
      () => selectProject(selected.slug),
    );
  }

  async function onCheckProjectEndpoints(serviceId?: string) {
    if (!selected) return;
    const endpoints = selected.endpoints.filter(
      (endpoint) => endpoint.healthCheckEnabled && (!serviceId || endpoint.serviceId === serviceId),
    );
    for (const endpoint of endpoints) {
      await onCheckEndpoint(endpoint.id);
    }
  }

  async function onUpsertMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    await runOperation(
      'upsertMember',
      async () => {
        await upsertMember(
          apiBaseUrl,
          selected.slug,
          { email: memberEmail, name: memberName, role: memberRole },
          token,
        );
        setMemberEmail('');
        setMemberName('');
        setMemberRole('VIEWER');
        await selectProject(selected.slug);
      },
      '成员已保存',
    );
  }

  async function onCreateCredential(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    await runOperation(
      'createCredential',
      async () => {
        const credential = await createCredential(
          apiBaseUrl,
          selected.slug,
          {
            serviceId: credentialServiceId,
            environmentSlug: credentialEnvironmentSlug,
            name: credentialName,
          },
          token,
        );
        setNewCredential(credential);
        setCredentialName('');
        setCredentialServiceId('');
        setCredentialEnvironmentSlug('');
        await selectProject(selected.slug);
        return credential;
      },
      (credential) => `已签发凭证 ${credential.name}`,
    );
  }

  async function onRotateCredential(credentialId: string) {
    if (!selected) return;
    await runOperation(
      `rotateCredential:${credentialId}`,
      async () => {
        const credential = await rotateCredential(apiBaseUrl, selected.slug, credentialId, token);
        setNewCredential(credential);
        await selectProject(selected.slug);
        return credential;
      },
      (credential) => `已轮换凭证 ${credential.name}`,
    );
  }

  async function onRevokeCredential(credentialId: string) {
    if (!selected) return;
    await runOperation(
      `revokeCredential:${credentialId}`,
      async () => {
        await revokeCredential(apiBaseUrl, selected.slug, credentialId, token);
        await selectProject(selected.slug);
      },
      '凭证已吊销',
    );
  }

  async function onCreateGovernanceRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    await runOperation(
      'createGovernanceRecord',
      async () => {
        await createGovernanceRecord(
          apiBaseUrl,
          selected.slug,
          { kind: governanceKind, name: governanceName, status: governanceStatus, data: {} },
          token,
        );
        setGovernanceKind('ALERT_RULE');
        setGovernanceName('');
        setGovernanceStatus('ACTIVE');
        await selectProject(selected.slug);
      },
      '治理记录已创建',
    );
  }

  async function onCreateObservabilityLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    await runOperation(
      'createObservabilityLink',
      async () => {
        await createObservabilityLink(
          apiBaseUrl,
          selected.slug,
          {
            title: observabilityTitle,
            url: observabilityUrl,
            signal: observabilitySignal,
          },
          token,
        );
        setObservabilityTitle('');
        setObservabilityUrl('');
        setObservabilitySignal('DASHBOARD');
        await selectProject(selected.slug);
      },
      '可观测性入口已添加',
    );
  }

  async function onLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runOperation(
      'login',
      async () => {
        const result = await login(apiBaseUrl, loginEmail, loginName);
        setToken(result.token);
        setUser(result.user);
        window.localStorage.setItem('team-platform-token', result.token);
        window.localStorage.setItem('team-platform-user', JSON.stringify(result.user));
        return result;
      },
      (result) => `已登录 ${result.user.email}`,
    );
  }

  function clearSession(message?: string) {
    setToken(null);
    setUser(null);
    setProjects(null);
    setSelected(null);
    setMembers([]);
    setCredentials([]);
    setObservabilityLinks([]);
    setGovernanceDashboard(null);
    setNewCredential(null);
    window.localStorage.removeItem('team-platform-token');
    window.localStorage.removeItem('team-platform-user');
    if (message) {
      setNotice({ tone: 'info', message });
    }
  }

  function handleError(err: unknown) {
    if (isAuthError(err)) {
      clearSession('登录已过期，请重新登录。');
      setError(null);
      return;
    }
    setError(errorMessage(err));
  }

  function navigateToWorkspace(workspace: WorkspaceView) {
    setError(null);
    setNotice(null);
    window.history.pushState(null, '', `#${workspace}`);
    setActiveWorkspace(workspace);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    window.scrollTo({ top: 0 });
  }

  function prepareCredential(service: ServiceDTO) {
    setCredentialServiceId(service.id);
    setCredentialEnvironmentSlug(selected?.environments[0]?.slug ?? '');
    setCredentialName(`${service.slug}-local`);
    navigateToWorkspace('access');
  }

  function prepareGovernanceRecord(service: ServiceDTO, kind: GovernanceRecordKind) {
    setGovernanceKind(kind);
    setGovernanceName(`${service.name} ${kind === 'DEPLOYMENT' ? '发布记录' : '治理项'}`);
    setGovernanceStatus('ACTIVE');
    navigateToWorkspace(kind === 'DEPLOYMENT' ? 'release' : 'governance');
  }

  useEffect(() => {
    const setWorkspaceFromHash = (hashValue = window.location.hash) => {
      const hash = hashValue.replace('#', '') || 'overview';
      setError(null);
      setNotice(null);
      setActiveWorkspace(workspaceByHash[hash] ?? 'overview');
    };
    const onSideNavClick = (event: MouseEvent) => {
      const target = event.target;
      const link =
        target instanceof Element
          ? target.closest<HTMLAnchorElement>('.side-nav a[href^="#"], .sidebar-links a[href^="#"]')
          : null;
      if (!link) return;
      event.preventDefault();
      const href = link.getAttribute('href') ?? '#overview';
      window.history.pushState(null, '', href);
      setWorkspaceFromHash(href);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      window.scrollTo({ top: 0 });
    };
    const onHistoryChange = () => setWorkspaceFromHash();
    const markActiveNav = () => {
      const currentHash = window.location.hash || '#overview';
      document
        .querySelectorAll<HTMLAnchorElement>('.side-nav a[href^="#"], .sidebar-links a[href^="#"]')
        .forEach((link) => {
          link.classList.toggle('active', link.getAttribute('href') === currentHash);
        });
    };

    setWorkspaceFromHash();
    markActiveNav();
    document.addEventListener('click', onSideNavClick);
    window.addEventListener('popstate', onHistoryChange);
    window.addEventListener('hashchange', onHistoryChange);
    window.addEventListener('hashchange', markActiveNav);
    return () => {
      document.removeEventListener('click', onSideNavClick);
      window.removeEventListener('popstate', onHistoryChange);
      window.removeEventListener('hashchange', onHistoryChange);
      window.removeEventListener('hashchange', markActiveNav);
    };
  }, []);

  useEffect(() => {
    void refreshProjects();
    // query 驱动目录刷新；selectProject 在 refreshProjects 内保持当前选择连续性。
  }, [apiBaseUrl, query, token]);

  useEffect(() => {
    const savedToken = window.localStorage.getItem('team-platform-token');
    const savedUser = window.localStorage.getItem('team-platform-user');
    if (savedToken) {
      setToken(savedToken);
    }
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser) as UserDTO);
      } catch {
        window.localStorage.removeItem('team-platform-user');
      }
    }
  }, []);

  return (
    <section aria-labelledby="registry-title" className="workspace platform-workspace">
      <WorkspaceHeader
        activeWorkspace={activeWorkspace}
        selected={selected}
        user={user}
        loadState={loadState}
        busyAction={busyAction}
        onRefresh={onManualRefresh}
        onLogout={() => clearSession('已退出当前会话')}
      />

      {error ? <div className="alert">{error}</div> : null}
      {notice ? <div className={`notice notice-${notice.tone}`}>{notice.message}</div> : null}

      {!hasSession ? (
        <LoginPanel
          loginEmail={loginEmail}
          loginName={loginName}
          busy={isBusy('login')}
          setLoginEmail={setLoginEmail}
          setLoginName={setLoginName}
          onLogin={onLogin}
        />
      ) : null}

      {activeWorkspace === 'overview' ? (
        <OverviewWorkspace
          hasSession={hasSession}
          selected={selected}
          summary={summary}
          governanceDashboard={governance}
          credentials={credentials}
          members={members}
          busyAction={busyAction}
          onRefresh={onManualRefresh}
          onCheckProjectEndpoints={onCheckProjectEndpoints}
          navigateToWorkspace={navigateToWorkspace}
        />
      ) : null}

      {activeWorkspace === 'catalog' ? (
        <CatalogWorkspace
          hasSession={hasSession}
          projects={projects}
          selected={selected}
          search={search}
          status={status}
          includeArchived={includeArchived}
          loadState={loadState}
          selectingSlug={selectingSlug}
          setSearch={setSearch}
          setStatus={setStatus}
          setIncludeArchived={setIncludeArchived}
          onSelectProject={selectProject}
          onRefresh={onManualRefresh}
        />
      ) : null}

      {activeWorkspace === 'services' ? (
        <ServicesWorkspace
          detail={selected}
          credentials={credentials}
          governanceDashboard={governance}
          observabilityLinks={observabilityLinks}
          busyAction={busyAction}
          onCheckProjectEndpoints={onCheckProjectEndpoints}
          onPrepareCredential={prepareCredential}
          onPrepareGovernanceRecord={prepareGovernanceRecord}
        />
      ) : null}

      {activeWorkspace === 'health' ? (
        <HealthWorkspace
          apiBaseUrl={apiBaseUrl}
          detail={selected}
          busyAction={busyAction}
          onCheckEndpoint={onCheckEndpoint}
          onCheckProjectEndpoints={onCheckProjectEndpoints}
        />
      ) : null}

      {activeWorkspace === 'governance' ? (
        <GovernanceWorkspace
          governanceDashboard={governance}
          governanceKind={governanceKind}
          governanceName={governanceName}
          governanceStatus={governanceStatus}
          busyAction={busyAction}
          setGovernanceKind={setGovernanceKind}
          setGovernanceName={setGovernanceName}
          setGovernanceStatus={setGovernanceStatus}
          onCreateGovernanceRecord={onCreateGovernanceRecord}
        />
      ) : null}

      {activeWorkspace === 'release' ? (
        <ReleaseWorkspace
          detail={selected}
          governanceDashboard={governance}
          governanceKind={governanceKind}
          governanceName={governanceName}
          governanceStatus={governanceStatus}
          busyAction={busyAction}
          setGovernanceKind={setGovernanceKind}
          setGovernanceName={setGovernanceName}
          setGovernanceStatus={setGovernanceStatus}
          onCreateGovernanceRecord={onCreateGovernanceRecord}
        />
      ) : null}

      {activeWorkspace === 'cost' ? (
        <CostWorkspace detail={selected} governanceDashboard={governance} />
      ) : null}

      {activeWorkspace === 'access' ? (
        <AccessWorkspace
          detail={selected}
          members={members}
          credentials={credentials}
          newCredential={newCredential}
          memberEmail={memberEmail}
          memberName={memberName}
          memberRole={memberRole}
          credentialName={credentialName}
          credentialServiceId={credentialServiceId}
          credentialEnvironmentSlug={credentialEnvironmentSlug}
          busyAction={busyAction}
          setMemberEmail={setMemberEmail}
          setMemberName={setMemberName}
          setMemberRole={setMemberRole}
          setCredentialName={setCredentialName}
          setCredentialServiceId={setCredentialServiceId}
          setCredentialEnvironmentSlug={setCredentialEnvironmentSlug}
          onUpsertMember={onUpsertMember}
          onCreateCredential={onCreateCredential}
          onRotateCredential={onRotateCredential}
          onRevokeCredential={onRevokeCredential}
        />
      ) : null}

      {activeWorkspace === 'integration' ? (
        <IntegrationWorkspace
          hasSession={hasSession}
          form={form}
          manifest={manifest}
          manifestResult={manifestResult}
          applyResult={applyResult}
          busyAction={busyAction}
          setForm={setForm}
          setManifest={setManifest}
          onCreateProject={onCreateProject}
          onValidateManifest={onValidateManifest}
          onApplyManifest={onApplyManifest}
        />
      ) : null}

      {activeWorkspace === 'observability' ? (
        <ObservabilityWorkspace
          detail={selected}
          observabilityLinks={observabilityLinks}
          observabilityTitle={observabilityTitle}
          observabilityUrl={observabilityUrl}
          observabilitySignal={observabilitySignal}
          busyAction={busyAction}
          setObservabilityTitle={setObservabilityTitle}
          setObservabilityUrl={setObservabilityUrl}
          setObservabilitySignal={setObservabilitySignal}
          onCreateObservabilityLink={onCreateObservabilityLink}
        />
      ) : null}
    </section>
  );
}

function WorkspaceHeader({
  activeWorkspace,
  selected,
  user,
  loadState,
  busyAction,
  onRefresh,
  onLogout,
}: {
  activeWorkspace: WorkspaceView;
  selected: ProjectDetailDTO | null;
  user: UserDTO | null;
  loadState: LoadState;
  busyAction: string | null;
  onRefresh: () => Promise<void>;
  onLogout: () => void;
}) {
  const copy = workspaceCopy[activeWorkspace];
  const titleSuffix =
    activeWorkspace === 'catalog'
      ? ''
      : ` / ${selected?.name ?? 'Manjv Studio'} / ${primaryEnvironmentName(selected)}`;
  return (
    <header className="workspace-header portal-header">
      <div>
        <div className="workspace-breadcrumb">
          <span>⌂</span>
          <span>›</span>
          <span>{copy.eyebrow}</span>
        </div>
        <h2 id="registry-title">
          {copy.label}
          {titleSuffix ? <span>{titleSuffix}</span> : null}
        </h2>
        <p>{copy.description}</p>
      </div>
      <div className="session-bar">
        <span className={`status-pill status-${loadState}`}>{loadStateLabel(loadState)}</span>
        {user ? <span>{user.email}</span> : <span>未登录</span>}
        <button
          type="button"
          className="secondary-btn"
          disabled={!user || busyAction === 'refreshProjects' || loadState === 'loading'}
          onClick={() => void onRefresh()}
        >
          <RefreshCw
            aria-hidden="true"
            className={busyAction === 'refreshProjects' ? 'spin-icon' : undefined}
          />
          刷新
        </button>
        {user ? (
          <button type="button" className="secondary-btn" onClick={onLogout}>
            退出
          </button>
        ) : null}
      </div>
    </header>
  );
}

function LoginPanel({
  loginEmail,
  loginName,
  busy,
  setLoginEmail,
  setLoginName,
  onLogin,
}: {
  loginEmail: string;
  loginName: string;
  busy: boolean;
  setLoginEmail: (value: string) => void;
  setLoginName: (value: string) => void;
  onLogin: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <section className="panel login-panel" aria-label="登录">
      <div>
        <p className="eyebrow">Local Session</p>
        <h3>进入治理工作台</h3>
        <p>本地环境使用邮箱登录，生产环境应替换为 SSO。</p>
      </div>
      <form className="login-form" onSubmit={(event) => void onLogin(event)}>
        <label>
          邮箱
          <input
            type="email"
            required
            value={loginEmail}
            disabled={busy}
            onChange={(event) => setLoginEmail(event.currentTarget.value)}
          />
        </label>
        <label>
          名称
          <input
            required
            value={loginName}
            disabled={busy}
            onChange={(event) => setLoginName(event.currentTarget.value)}
          />
        </label>
        <button type="submit" className="primary-btn" disabled={busy}>
          <KeyRound aria-hidden="true" />
          {busy ? '登录中' : '登录'}
        </button>
      </form>
    </section>
  );
}

function OverviewWorkspace({
  hasSession,
  selected,
  summary,
  governanceDashboard,
  credentials,
  members,
  busyAction,
  onRefresh,
  onCheckProjectEndpoints,
  navigateToWorkspace,
}: {
  hasSession: boolean;
  selected: ProjectDetailDTO | null;
  summary: DashboardSummary;
  governanceDashboard: GovernanceDashboardDTO;
  credentials: ServiceCredentialDTO[];
  members: ProjectMemberDTO[];
  busyAction: string | null;
  onRefresh: () => Promise<void>;
  onCheckProjectEndpoints: () => Promise<void>;
  navigateToWorkspace: (workspace: WorkspaceView) => void;
}) {
  const checkingEndpoints = busyAction?.startsWith('checkEndpoint:') ?? false;
  const canCheckEndpoints = Boolean(
    selected?.endpoints.some((endpoint) => endpoint.healthCheckEnabled),
  );
  const alertRecords = governanceDashboard.alerts;
  const deploymentRecords = governanceDashboard.deployments;

  return (
    <div className={hasSession ? 'workspace-view overview-grid' : 'workspace-view muted-grid'}>
      <section className="panel risk-summary-panel" aria-label="风险与待办摘要">
        <div className="risk-panel-head">
          <h3>风险与待办摘要</h3>
          <button
            type="button"
            className="secondary-btn small-btn"
            disabled={busyAction === 'refreshProjects'}
            onClick={() => void onRefresh()}
          >
            <RefreshCw
              aria-hidden="true"
              className={busyAction === 'refreshProjects' ? 'spin-icon' : undefined}
            />
            刷新
          </button>
        </div>
        <div className="risk-summary-grid">
          <MetricTile
            icon={<HeartPulse aria-hidden="true" />}
            label="风险服务"
            value={summary.downEndpointCount}
            detail={summary.downEndpointCount > 0 ? '存在异常服务' : '无高风险服务'}
          />
          <MetricTile
            icon={<Bell aria-hidden="true" />}
            label="告警总数"
            value={summary.activeAlerts}
            detail={summary.activeAlerts > 0 ? '需要处理' : '无活跃告警'}
          />
          <MetricTile
            icon={<ClipboardCheck aria-hidden="true" />}
            label="待治理事项"
            value={governanceDashboard.summary.openDeployments}
            detail={governanceDashboard.summary.openDeployments > 0 ? '待完成发布' : '暂无待处理'}
          />
          <MetricTile
            icon={<KeyRound aria-hidden="true" />}
            label="凭证即将过期"
            value={credentials.filter((item) => item.expiresAt).length}
            detail="有过期时间"
          />
          <MetricTile
            icon={<WalletCards aria-hidden="true" />}
            label="本月成本"
            value={formatCents(summary.monthlyCostCents)}
            detail="真实治理汇总"
          />
        </div>
      </section>

      <section className="panel" aria-label="服务健康矩阵">
        <PanelTitle
          title="服务健康矩阵"
          desc="首屏展示服务、环境、端点健康和最后检测。"
          actionLabel={`查看全部服务（${summary.serviceCount}）`}
          onAction={() => navigateToWorkspace('services')}
        />
        <ServiceHealthTable detail={selected} />
      </section>

      <section className="panel project-info-card" aria-label="环境与项目信息">
        <PanelTitle title="环境与项目信息" />
        {selected ? (
          <>
            <dl className="project-info-list">
              <div>
                <dt>项目</dt>
                <dd>
                  {selected.name}
                  <span className={`status-pill status-${selected.status.toLowerCase()}`}>
                    {selected.status}
                  </span>
                </dd>
              </div>
              <div>
                <dt>环境</dt>
                <dd>
                  <span className="health-dot" data-tone="ok" />
                  {primaryEnvironmentName(selected)}
                </dd>
              </div>
              <div>
                <dt>负责人</dt>
                <dd>
                  {selected.ownerName}
                  <small>{selected.ownerEmail ?? ''}</small>
                </dd>
              </div>
              <div>
                <dt>团队</dt>
                <dd>
                  项目成员<small>{members.length} 人</small>
                </dd>
              </div>
              <div>
                <dt>创建时间</dt>
                <dd>{formatFullDate(selected.createdAt)}</dd>
              </div>
              <div>
                <dt>项目仓库</dt>
                <dd className="mono-line">{selected.repositoryUrl ?? '未配置仓库'}</dd>
              </div>
            </dl>
            <ProjectMetaLine detail={selected} />
            <div className="info-metric-grid">
              <MetricTile
                icon={<HeartPulse aria-hidden="true" />}
                label="健康"
                value={`${summary.healthyEndpointCount}/${summary.endpointCount}`}
                detail={summary.downEndpointCount > 0 ? '存在异常' : '无异常端点'}
              />
              <MetricTile
                icon={<Server aria-hidden="true" />}
                label="服务"
                value={summary.serviceCount}
                detail={`${summary.environmentCount} 个环境`}
              />
              <MetricTile
                icon={<Bell aria-hidden="true" />}
                label="告警"
                value={summary.activeAlerts}
                detail="当前活跃"
              />
              <MetricTile
                icon={<WalletCards aria-hidden="true" />}
                label="月成本"
                value={formatCents(summary.monthlyCostCents)}
                detail="本月累计"
              />
              <MetricTile
                icon={<KeyRound aria-hidden="true" />}
                label="凭证"
                value={credentials.length}
                detail="服务身份"
              />
              <MetricTile
                icon={<Rocket aria-hidden="true" />}
                label="最近发布"
                value={deploymentRecords.length}
                detail="真实记录"
              />
            </div>
          </>
        ) : (
          <div className="empty-state">选择项目后查看环境信息</div>
        )}
      </section>

      <section className="panel" aria-label="最近发布">
        <PanelTitle
          title="最近发布"
          actionLabel="查看全部发布"
          onAction={() => navigateToWorkspace('release')}
        />
        <ReleaseMiniTable records={deploymentRecords} />
      </section>

      <section className="panel" aria-label="告警队列">
        <PanelTitle
          title="告警队列"
          actionLabel="查看全部告警"
          onAction={() => navigateToWorkspace('governance')}
        />
        {alertRecords.length > 0 ? (
          <RecordTable records={alertRecords} emptyText="暂无告警" />
        ) : (
          <div className="empty-bell">
            <Bell aria-hidden="true" />
            <strong>当前没有活跃告警</strong>
            <span>治理 API 暂无告警记录</span>
          </div>
        )}
      </section>

      <section className="panel" aria-label="关键操作">
        <PanelTitle title="关键操作" />
        <div className="quick-action-grid">
          <button
            type="button"
            className="side-action"
            disabled={!selected || !canCheckEndpoints || checkingEndpoints}
            onClick={() => void onCheckProjectEndpoints()}
          >
            <ClipboardCheck aria-hidden="true" />
            <span>
              <strong>{checkingEndpoints ? '检测中' : '检测端点'}</strong>
              <small>检查当前项目所有健康端点</small>
            </span>
            <ArrowRight aria-hidden="true" />
          </button>
          <button
            type="button"
            className="side-action"
            onClick={() => navigateToWorkspace('services')}
          >
            <Server aria-hidden="true" />
            <span>
              <strong>查看服务</strong>
              <small>进入服务与环境分屏工作台</small>
            </span>
            <ArrowRight aria-hidden="true" />
          </button>
          <button
            type="button"
            className="side-action"
            onClick={() => navigateToWorkspace('access')}
          >
            <KeyRound aria-hidden="true" />
            <span>
              <strong>新增凭证</strong>
              <small>签发服务身份或轮换凭证</small>
            </span>
            <ArrowRight aria-hidden="true" />
          </button>
          <button
            type="button"
            className="side-action"
            onClick={() => navigateToWorkspace('integration')}
          >
            <UploadCloud aria-hidden="true" />
            <span>
              <strong>接入 Manjv Studio</strong>
              <small>使用 http://localhost:3100 生成治理清单</small>
            </span>
            <ArrowRight aria-hidden="true" />
          </button>
        </div>
      </section>
    </div>
  );
}

function CatalogWorkspace({
  hasSession,
  projects,
  selected,
  search,
  status,
  includeArchived,
  loadState,
  selectingSlug,
  setSearch,
  setStatus,
  setIncludeArchived,
  onSelectProject,
  onRefresh,
}: {
  hasSession: boolean;
  projects: PagedResult<ProjectDTO> | null;
  selected: ProjectDetailDTO | null;
  search: string;
  status: ProjectStatus | '';
  includeArchived: boolean;
  loadState: LoadState;
  selectingSlug: string | null;
  setSearch: (value: string) => void;
  setStatus: (value: ProjectStatus | '') => void;
  setIncludeArchived: (value: boolean) => void;
  onSelectProject: (slug: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const projectItems = catalogDisplayRows(projects, selected, search, status, includeArchived);
  return (
    <div className={hasSession ? 'workspace-view catalog-grid' : 'workspace-view muted-grid'}>
      <section className="panel catalog-list-panel" aria-label="项目目录">
        <PanelTitle
          title="项目目录"
          desc={loadState === 'loading' ? '正在加载项目...' : `共 ${projects?.total ?? 0} 个项目`}
          actionLabel="刷新"
          onAction={() => void onRefresh()}
        />
        <div className="catalog-viewbar" aria-label="项目目录视图切换">
          <div className="segmented compact">
            <button type="button" className="active">
              表格视图
            </button>
            <button type="button" disabled title="卡片视图暂未接入">
              卡片视图
            </button>
          </div>
          <button
            type="button"
            className="secondary-btn small-btn"
            onClick={() => void onRefresh()}
          >
            <RefreshCw aria-hidden="true" />
          </button>
        </div>
        <div className="catalog-toolbar">
          <label className="search-field">
            <Search aria-hidden="true" />
            <input
              value={search}
              disabled={!hasSession}
              onChange={(event) => setSearch(event.currentTarget.value)}
              placeholder="搜索项目、负责人、标签"
              aria-label="搜索项目"
            />
          </label>
          <select
            value={status}
            disabled={!hasSession}
            onChange={(event) => setStatus(event.currentTarget.value as ProjectStatus | '')}
            aria-label="按状态筛选"
          >
            <option value="">全部状态</option>
            {projectStatuses.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <label className="inline-check">
            <input
              type="checkbox"
              checked={includeArchived}
              disabled={!hasSession}
              onChange={(event) => setIncludeArchived(event.currentTarget.checked)}
            />
            包含归档
          </label>
          <button
            type="button"
            className="secondary-btn small-btn"
            disabled
            title="更多筛选暂未接入"
          >
            筛选已同步
          </button>
        </div>

        <div className="table-wrap">
          <div className="data-table project-table">
            <div className="data-row data-head">
              <span>项目</span>
              <span>负责人</span>
              <span>类型</span>
              <span>健康</span>
              <span>服务</span>
              <span>更新时间</span>
              <span>标签</span>
            </div>
            {projectItems.length > 0 ? (
              projectItems.map((project) => (
                <button
                  type="button"
                  key={project.id}
                  className={
                    selected?.slug === project.slug
                      ? 'data-row project-row active'
                      : 'data-row project-row'
                  }
                  disabled={selectingSlug === project.slug}
                  onClick={() => {
                    void onSelectProject(project.slug);
                  }}
                >
                  <span>
                    <strong>{project.name}</strong>
                    <small>{project.slug}</small>
                  </span>
                  <span>
                    <strong>{project.ownerName}</strong>
                    <small>{project.ownerEmail ?? '-'}</small>
                  </span>
                  <span>{project.type}</span>
                  <span>
                    <span
                      className="health-dot"
                      data-tone={
                        project.health.startsWith('4') || project.health.startsWith('3')
                          ? 'ok'
                          : 'warning'
                      }
                    />
                    <strong>{project.health}</strong>
                    <small>
                      {project.status === 'MAINTENANCE'
                        ? '警告'
                        : project.status === 'ARCHIVED'
                          ? '归档'
                          : '健康'}
                    </small>
                  </span>
                  <span>{project.serviceCount ?? '-'}</span>
                  <span>{formatShortDate(project.updatedAt)}</span>
                  <span className="tag-line">
                    {project.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="tag-chip">
                        {tag}
                      </span>
                    ))}
                    {project.tags.length > 3 ? (
                      <span className="tag-chip">+{project.tags.length - 3}</span>
                    ) : null}
                  </span>
                </button>
              ))
            ) : (
              <div className="empty-state">{hasSession ? '暂无项目' : '登录后查看项目目录'}</div>
            )}
          </div>
        </div>
        <div className="table-footer">
          <span>
            共 {projects?.total ?? 0} 条 · 第 {projects?.page ?? 1}/{projects?.totalPages ?? 1} 页
          </span>
          <div>
            <button type="button" className="secondary-btn small-btn" disabled>
              ‹
            </button>
            <button type="button" className="primary-btn small-btn" disabled>
              {projects?.page ?? 1}
            </button>
            <button type="button" className="secondary-btn small-btn">
              ›
            </button>
          </div>
        </div>
      </section>

      <section className="panel inspector-panel" aria-label="项目检查器">
        <ProjectInspector detail={selected} />
      </section>
    </div>
  );
}

function ProjectInspector({ detail }: { detail: ProjectDetailDTO | null }) {
  if (!detail) {
    return <div className="empty-state">选择一个项目查看治理详情</div>;
  }
  const health = projectHealth(detail);
  return (
    <>
      <div className="inspector-head">
        <div>
          <h3>{detail.name}</h3>
          <span className={`status-pill status-${detail.status.toLowerCase()}`}>
            {detail.status}
          </span>
        </div>
        <div className="inspector-icons">
          <button
            type="button"
            className="icon-button"
            aria-label="收藏项目"
            disabled
            title="收藏暂未接入"
          >
            ☆
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="关闭检查器"
            disabled
            title="检查器随项目选择展示，暂不支持关闭"
          >
            ×
          </button>
        </div>
      </div>
      <div className="inspector-action-row">
        <a
          className="primary-btn small-btn"
          href={detail.documentationUrl ?? detail.repositoryUrl ?? '#'}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink aria-hidden="true" />
          打开项目
        </a>
        <button
          type="button"
          className="secondary-btn small-btn"
          disabled
          title="请在健康状态或服务与环境中检测端点"
        >
          <ClipboardCheck aria-hidden="true" />
          检测端点
        </button>
        <a className="secondary-btn small-btn" href="#services">
          <Server aria-hidden="true" />
          查看服务
        </a>
        <button
          type="button"
          className="secondary-btn small-btn"
          aria-label="更多操作"
          disabled
          title="更多操作暂未接入"
        >
          <MoreHorizontal aria-hidden="true" />
        </button>
      </div>
      <section className="inspector-section">
        <h3>基本信息</h3>
        <dl className="project-info-list compact-info">
          <div>
            <dt>项目标识</dt>
            <dd>{detail.slug}</dd>
          </div>
          <div>
            <dt>仓库路径</dt>
            <dd className="mono-line">{detail.repositoryUrl ?? '未配置仓库'}</dd>
          </div>
          <div>
            <dt>负责人</dt>
            <dd>
              {detail.ownerName}
              <small>{detail.ownerEmail ?? ''}</small>
            </dd>
          </div>
          <div>
            <dt>类型</dt>
            <dd>{detail.type}</dd>
          </div>
          <div>
            <dt>创建时间</dt>
            <dd>{formatFullDate(detail.createdAt)}</dd>
          </div>
          <div>
            <dt>描述</dt>
            <dd>{detail.description ?? '未配置描述'}</dd>
          </div>
        </dl>
      </section>
      <div className="inspector-score-grid">
        <MetricTile
          icon={<HeartPulse aria-hidden="true" />}
          label="端点健康"
          value={`${health.healthy}/${health.total}`}
          detail="全部健康"
        />
        <MetricTile
          icon={<LineChart aria-hidden="true" />}
          label="质量分"
          value={health.down > 0 ? 82 : 100}
          detail={health.down > 0 ? '需关注' : '优秀'}
        />
      </div>
      <section className="inspector-section">
        <h3>标签</h3>
        <div className="tag-line expanded-tags">
          {detail.tags.map((tag) => (
            <span key={tag} className="tag-chip">
              {tag}
            </span>
          ))}
          <button
            type="button"
            className="secondary-btn small-btn"
            disabled
            title="标签编辑暂未接入"
          >
            +
          </button>
        </div>
      </section>
      <dl className="facts inspector-facts visually-hidden">
        <div>
          <dt>负责人</dt>
          <dd>
            {detail.ownerEmail ? `${detail.ownerName} · ${detail.ownerEmail}` : detail.ownerName}
          </dd>
        </div>
        <div>
          <dt>端点健康</dt>
          <dd>
            {health.healthy}/{health.total}
          </dd>
        </div>
        <div>
          <dt>服务</dt>
          <dd>{detail.services.length}</dd>
        </div>
        <div>
          <dt>环境</dt>
          <dd>{detail.environments.length}</dd>
        </div>
      </dl>
      <section className="inspector-section relation-panel" aria-label="项目关系">
        <h3>项目关系</h3>
        {detail.services.length > 0 ? (
          <div className="relation-map" aria-hidden="true">
            {detail.services.slice(0, 2).map((service) => (
              <span key={service.id}>{service.name}</span>
            ))}
            <i />
            <strong>{detail.name}</strong>
            <i />
            {detail.environments.slice(0, 2).map((environment) => (
              <span key={environment.id}>{environment.name}</span>
            ))}
          </div>
        ) : (
          <div className="empty-state compact-empty">暂无真实服务关系</div>
        )}
      </section>
      <section className="inspector-section" aria-label="最近活动">
        <h3>最近活动</h3>
        <div className="empty-state compact-empty">暂无真实活动记录</div>
      </section>
    </>
  );
}

function ServicesWorkspace({
  detail,
  credentials,
  governanceDashboard,
  observabilityLinks,
  busyAction,
  onCheckProjectEndpoints,
  onPrepareCredential,
  onPrepareGovernanceRecord,
}: {
  detail: ProjectDetailDTO | null;
  credentials: ServiceCredentialDTO[];
  governanceDashboard: GovernanceDashboardDTO;
  observabilityLinks: ObservabilityLinkDTO[];
  busyAction: string | null;
  onCheckProjectEndpoints: (serviceId?: string) => Promise<void>;
  onPrepareCredential: (service: ServiceDTO) => void;
  onPrepareGovernanceRecord: (service: ServiceDTO, kind: GovernanceRecordKind) => void;
}) {
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [serviceSearch, setServiceSearch] = useState('');

  useEffect(() => {
    const firstServiceId = detail?.services[0]?.id ?? null;
    if (!detail?.services.some((service) => service.id === selectedServiceId)) {
      setSelectedServiceId(firstServiceId);
    }
  }, [detail, selectedServiceId]);

  if (!detail) {
    return <EmptyWorkspace text="选择一个项目查看服务与环境。" />;
  }

  const selectedService =
    detail.services.find((service) => service.id === selectedServiceId) ?? detail.services[0];
  const normalizedServiceSearch = serviceSearch.trim().toLowerCase();
  const visibleServices = normalizedServiceSearch
    ? detail.services.filter((service) =>
        [service.name, service.slug, service.type]
          .join(' ')
          .toLowerCase()
          .includes(normalizedServiceSearch),
      )
    : detail.services;
  const selectedEndpoints = selectedService ? endpointsForService(detail, selectedService.id) : [];
  const serviceCredentials = selectedService
    ? credentials.filter((credential) => credential.serviceId === selectedService.id)
    : [];
  const logsLink =
    observabilityLinks.find((link) => link.signal === 'LOGS') ?? observabilityLinks[0];
  const checkingEndpoints = busyAction?.startsWith('checkEndpoint:') ?? false;

  return (
    <div className="workspace-view service-workbench">
      <aside className="panel explorer-panel" aria-label="服务资源树">
        <PanelTitle title={detail.name} desc="服务、环境和成员资源树。" />
        <label className="search-field">
          <Search aria-hidden="true" />
          <input
            value={serviceSearch}
            onChange={(event) => setServiceSearch(event.currentTarget.value)}
            placeholder="搜索项目/服务/端点"
            aria-label="搜索工作区"
          />
        </label>
        <ExplorerGroup title="服务" count={visibleServices.length}>
          {visibleServices.length > 0 ? (
            visibleServices.map((service) => (
              <button
                type="button"
                key={service.id}
                className={
                  selectedService?.id === service.id ? 'explorer-item active' : 'explorer-item'
                }
                onClick={() => setSelectedServiceId(service.id)}
              >
                <Globe2 aria-hidden="true" />
                <span>
                  <strong>{service.name}</strong>
                  <small>{service.type}</small>
                </span>
              </button>
            ))
          ) : (
            <div className="empty-state compact-empty">无匹配服务</div>
          )}
        </ExplorerGroup>
        <ExplorerGroup title="环境" count={detail.environments.length}>
          {detail.environments.map((environment) => (
            <div key={environment.id} className="explorer-item static">
              <Database aria-hidden="true" />
              <span>
                <strong>{environment.name}</strong>
                <small>{environment.slug}</small>
              </span>
            </div>
          ))}
        </ExplorerGroup>
      </aside>

      <section className="panel workbench-main" aria-label="服务拓扑">
        <PanelTitle
          title="服务拓扑"
          desc="按服务聚合端点、环境、凭证和健康状态。"
          actionLabel={checkingEndpoints ? '检测中' : '检测端点'}
          onAction={() => void onCheckProjectEndpoints()}
        />
        <ServiceMatrix detail={detail} />
        <div className="table-wrap">
          <div className="data-table service-table">
            <div className="data-row data-head">
              <span>服务</span>
              <span>类型</span>
              <span>端点健康</span>
              <span>环境</span>
              <span>凭证</span>
              <span>操作</span>
            </div>
            {visibleServices.map((service) => {
              const endpoints = endpointsForService(detail, service.id);
              const health = serviceHealth(endpoints);
              const credentialCount = credentials.filter(
                (credential) => credential.serviceId === service.id,
              ).length;
              return (
                <button
                  type="button"
                  key={service.id}
                  className={
                    selectedService?.id === service.id
                      ? 'data-row service-row active'
                      : 'data-row service-row'
                  }
                  onClick={() => setSelectedServiceId(service.id)}
                >
                  <span>
                    <strong>{service.name}</strong>
                    <small>{service.slug}</small>
                  </span>
                  <span>{service.type}</span>
                  <span>
                    <HealthRatio healthy={health.healthy} total={health.total} />
                  </span>
                  <span>{environmentSummary(detail, endpoints)}</span>
                  <span>{credentialCount}</span>
                  <span className="row-actions">
                    <MoreHorizontal aria-hidden="true" />
                  </span>
                </button>
              );
            })}
            {visibleServices.length === 0 ? <div className="empty-state">无匹配服务</div> : null}
          </div>
        </div>
      </section>

      <aside className="panel inspector-panel" aria-label="服务详情">
        {selectedService ? (
          <>
            <div className="inspector-head">
              <div>
                <p className="eyebrow">Service Inspector</p>
                <h3>{selectedService.name}</h3>
                <span>{selectedService.slug}</span>
              </div>
              <StatusBadge status={serviceStatusTone(selectedEndpoints)} />
            </div>
            <dl className="facts inspector-facts">
              <div>
                <dt>类型</dt>
                <dd>{selectedService.type}</dd>
              </div>
              <div>
                <dt>端点</dt>
                <dd>{selectedEndpoints.length}</dd>
              </div>
              <div>
                <dt>凭证</dt>
                <dd>{serviceCredentials.length}</dd>
              </div>
              <div>
                <dt>发布</dt>
                <dd>{governanceDashboard.deployments.length}</dd>
              </div>
            </dl>
            <EndpointList
              endpoints={selectedEndpoints}
              busyAction={busyAction}
              onCheckEndpoint={onCheckProjectEndpoints}
            />
            <div className="button-row">
              <button
                type="button"
                className="primary-btn small-btn"
                disabled={selectedEndpoints.length === 0 || checkingEndpoints}
                onClick={() => void onCheckProjectEndpoints(selectedService.id)}
              >
                <ClipboardCheck aria-hidden="true" />
                {checkingEndpoints ? '检测中' : '立即检测'}
              </button>
              <button
                type="button"
                className="secondary-btn small-btn"
                onClick={() => onPrepareCredential(selectedService)}
              >
                <KeyRound aria-hidden="true" />
                创建凭证
              </button>
              <button
                type="button"
                className="secondary-btn small-btn"
                onClick={() => onPrepareGovernanceRecord(selectedService, 'ALERT_RULE')}
              >
                <Bell aria-hidden="true" />
                添加治理
              </button>
              {logsLink ? (
                <a
                  className="secondary-btn small-btn"
                  href={logsLink.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink aria-hidden="true" />
                  日志
                </a>
              ) : null}
            </div>
          </>
        ) : (
          <div className="empty-state">选择一个服务查看详情</div>
        )}
      </aside>
    </div>
  );
}

function HealthWorkspace({
  apiBaseUrl,
  detail,
  busyAction,
  onCheckEndpoint,
  onCheckProjectEndpoints,
}: {
  apiBaseUrl: string;
  detail: ProjectDetailDTO | null;
  busyAction: string | null;
  onCheckEndpoint: (endpointId: string) => Promise<void>;
  onCheckProjectEndpoints: () => Promise<void>;
}) {
  const [range, setRange] = useState('24h');
  const health = detail ? projectHealth(detail) : { healthy: 0, total: 0, down: 0 };
  const checkingEndpoints = busyAction?.startsWith('checkEndpoint:') ?? false;
  return (
    <div className="workspace-view health-grid">
      <section className="panel health-command" aria-label="项目健康">
        <PanelTitle
          title={detail ? `${detail.name} 健康状态` : '项目健康状态'}
          desc="项目端点、依赖关系和最近检测事件。"
        />
        <div className="segmented">
          {['1h', '24h', '7d'].map((item) => (
            <button
              type="button"
              key={item}
              className={range === item ? 'active' : ''}
              onClick={() => setRange(item)}
            >
              {item}
            </button>
          ))}
          <button
            type="button"
            className="primary-btn small-btn"
            disabled={!detail || checkingEndpoints}
            onClick={() => void onCheckProjectEndpoints()}
          >
            <ClipboardCheck aria-hidden="true" />
            {checkingEndpoints ? '检测中' : '检测端点'}
          </button>
        </div>
        <div className="metric-strip">
          <MetricTile
            icon={<HeartPulse aria-hidden="true" />}
            label="整体健康"
            value={scoreLabel(health)}
            detail={range}
          />
          <MetricTile
            icon={<Globe2 aria-hidden="true" />}
            label="端点"
            value={`${health.healthy}/${health.total}`}
            detail="健康端点"
          />
          <MetricTile
            icon={<Bell aria-hidden="true" />}
            label="异常端点"
            value={health.down}
            detail="当前异常"
          />
          <MetricTile
            icon={<LineChart aria-hidden="true" />}
            label="平均响应"
            value={averageLatency(detail?.endpoints ?? [])}
            detail="最近检测"
          />
        </div>
        <div className="chart-panel">
          <div className="sparkline" aria-hidden="true">
            {Array.from({ length: 28 }).map((_, index) => (
              <span key={index} style={{ height: `${26 + ((index * 17) % 52)}px` }} />
            ))}
          </div>
          <p>{range} 内没有发现持续异常，端点检测结果以真实 API 返回为准。</p>
        </div>
      </section>
      <section className="panel" aria-label="端点检查表">
        <PanelTitle title="端点检查表" desc="每一行的检测按钮都会调用真实端点检测 API。" />
        <EndpointTable detail={detail} busyAction={busyAction} onCheckEndpoint={onCheckEndpoint} />
      </section>
      <section className="panel system-health-panel" aria-label="平台基础设施">
        <StatusDashboard apiBaseUrl={apiBaseUrl} />
      </section>
    </div>
  );
}

function GovernanceWorkspace({
  governanceDashboard,
  governanceKind,
  governanceName,
  governanceStatus,
  busyAction,
  setGovernanceKind,
  setGovernanceName,
  setGovernanceStatus,
  onCreateGovernanceRecord,
}: {
  governanceDashboard: GovernanceDashboardDTO;
  governanceKind: GovernanceRecordKind;
  governanceName: string;
  governanceStatus: string;
  busyAction: string | null;
  setGovernanceKind: (value: GovernanceRecordKind) => void;
  setGovernanceName: (value: string) => void;
  setGovernanceStatus: (value: string) => void;
  onCreateGovernanceRecord: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  const [mode, setMode] = useState('当前告警');
  const recordsByMode: Record<string, GovernanceRecordDTO[]> = {
    当前告警: governanceDashboard.alerts,
    规则: governanceDashboard.configurations,
    静默: governanceDashboard.secretReferences,
    策略: [...governanceDashboard.modelRoutes, ...governanceDashboard.tasks],
  };
  const modeRecords = recordsByMode[mode] ?? [];
  const selectedRecord = modeRecords[0] ?? null;
  return (
    <div className="workspace-view governance-board">
      <section className="panel governance-main" aria-label="告警治理">
        <div className="dense-tabs">
          {Object.keys(recordsByMode).map((item) => (
            <button
              type="button"
              key={item}
              className={mode === item ? 'active' : ''}
              onClick={() => setMode(item)}
            >
              {item}
              {item === '当前告警' && governanceDashboard.alerts.length > 0 ? (
                <span>{governanceDashboard.alerts.length}</span>
              ) : null}
            </button>
          ))}
        </div>
        <div className="filter-strip">
          {['全部级别', '全部服务', '全部负责人', '全部状态', '最近 24 小时'].map((item) => (
            <select key={item} aria-label={item} defaultValue={item} disabled title="筛选暂未接入">
              <option>{item}</option>
            </select>
          ))}
          <button type="button" className="text-button" disabled title="筛选面板暂未接入">
            筛选暂未接入
          </button>
        </div>
        <div className="metric-strip dense-metrics">
          <MetricTile
            icon={<Bell aria-hidden="true" />}
            label="活跃中"
            value={governanceDashboard.summary.activeAlerts}
            detail="真实告警"
          />
          <MetricTile
            icon={<ClipboardCheck aria-hidden="true" />}
            label="配置项"
            value={governanceDashboard.summary.configurationItems}
            detail="真实记录"
          />
          <MetricTile
            icon={<RefreshCw aria-hidden="true" />}
            label="发布记录"
            value={governanceDashboard.summary.openDeployments}
            detail="真实发布"
          />
          <MetricTile
            icon={<HeartPulse aria-hidden="true" />}
            label="密钥引用"
            value={governanceDashboard.summary.secretReferences}
            detail="真实配置"
          />
          <MetricTile
            icon={<LineChart aria-hidden="true" />}
            label="任务/路由"
            value={governanceDashboard.tasks.length + governanceDashboard.modelRoutes.length}
            detail="真实记录"
          />
        </div>
        <div className="alert-actionbar">
          <span>0 已选择</span>
          {['确认', '分配', '静默', '关闭', '创建工单', '更多'].map((item) => (
            <button
              type="button"
              className="secondary-btn small-btn"
              key={item}
              disabled
              title={`${item}暂未接入真实工单/告警状态 API`}
            >
              {item}
            </button>
          ))}
          <select aria-label="排序" defaultValue="触发时间" disabled title="排序暂未接入">
            <option>排序：触发时间</option>
          </select>
        </div>
        <RecordTable records={modeRecords} emptyText={`${mode} 暂无真实记录`} />
        <section className="subtable-panel">
          <h3>规则质量检查</h3>
          <div className="empty-state compact-empty">暂无真实质量检查记录</div>
        </section>
      </section>
      <aside className="panel inspector-panel governance-side" aria-label="治理建议">
        <PanelTitle title="治理概览" />
        <div className="side-card-grid">
          <MetricTile
            icon={<LineChart aria-hidden="true" />}
            label="告警"
            value={governanceDashboard.alerts.length}
            detail="真实记录"
          />
          <MetricTile
            icon={<Bell aria-hidden="true" />}
            label="配置"
            value={governanceDashboard.configurations.length}
            detail="真实记录"
          />
          <MetricTile
            icon={<Users aria-hidden="true" />}
            label="模型路由"
            value={governanceDashboard.modelRoutes.length}
            detail="真实记录"
          />
          <MetricTile
            icon={<RefreshCw aria-hidden="true" />}
            label="任务"
            value={governanceDashboard.tasks.length}
            detail="真实记录"
          />
        </div>
        <PanelTitle title="建议动作" />
        <div className="empty-state compact-empty">暂无真实治理建议</div>
        <PanelTitle title="规则详情" />
        {selectedRecord ? (
          <dl className="project-info-list compact-info">
            <div>
              <dt>类型</dt>
              <dd>{selectedRecord.kind}</dd>
            </div>
            <div>
              <dt>名称</dt>
              <dd>{selectedRecord.name}</dd>
            </div>
            <div>
              <dt>状态</dt>
              <dd>{selectedRecord.status}</dd>
            </div>
            <div>
              <dt>环境</dt>
              <dd>{selectedRecord.environmentSlug ?? 'all env'}</dd>
            </div>
            <div>
              <dt>更新时间</dt>
              <dd>{formatFullDate(selectedRecord.updatedAt)}</dd>
            </div>
          </dl>
        ) : (
          <div className="empty-state compact-empty">选择真实记录后查看详情</div>
        )}
        <div className="folded-form">
          <GovernanceForm
            governanceKind={governanceKind}
            governanceName={governanceName}
            governanceStatus={governanceStatus}
            busyAction={busyAction}
            setGovernanceKind={setGovernanceKind}
            setGovernanceName={setGovernanceName}
            setGovernanceStatus={setGovernanceStatus}
            onCreateGovernanceRecord={onCreateGovernanceRecord}
          />
        </div>
      </aside>
    </div>
  );
}

function ReleaseWorkspace({
  detail,
  governanceDashboard,
  governanceKind,
  governanceName,
  governanceStatus,
  busyAction,
  setGovernanceKind,
  setGovernanceName,
  setGovernanceStatus,
  onCreateGovernanceRecord,
}: {
  detail: ProjectDetailDTO | null;
  governanceDashboard: GovernanceDashboardDTO;
  governanceKind: GovernanceRecordKind;
  governanceName: string;
  governanceStatus: string;
  busyAction: string | null;
  setGovernanceKind: (value: GovernanceRecordKind) => void;
  setGovernanceName: (value: string) => void;
  setGovernanceStatus: (value: string) => void;
  onCreateGovernanceRecord: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  const [environment, setEnvironment] = useState('');
  const lanes = detail?.environments ?? [];
  const deploymentRecords = governanceDashboard.deployments;
  const visibleDeployments = environment
    ? deploymentRecords.filter((record) => record.environmentSlug === environment)
    : deploymentRecords;
  const selectedDeployment = visibleDeployments[0] ?? null;
  return (
    <div className="workspace-view release-board">
      <section className="panel release-pipeline" aria-label="发布记录">
        <div className="release-actions">
          <button
            type="button"
            className="primary-btn small-btn"
            onClick={() => {
              setGovernanceKind('DEPLOYMENT');
              setGovernanceName(detail ? `${detail.name} 发布记录` : '发布记录');
              setGovernanceStatus('ACTIVE');
            }}
          >
            <Plus aria-hidden="true" />
            新建发布记录
          </button>
          <button
            type="button"
            className="secondary-btn small-btn"
            disabled
            title="Git 同步暂未接入"
          >
            <RefreshCw aria-hidden="true" />
            同步 Git
          </button>
          <button type="button" className="secondary-btn small-btn" disabled title="回滚暂未接入">
            回滚
          </button>
        </div>
        <div className="release-lanes">
          <button
            type="button"
            className={environment === '' ? 'release-lane active' : 'release-lane'}
            onClick={() => setEnvironment('')}
          >
            <small>全部环境</small>
            <strong>{deploymentRecords.length}</strong>
            <span className="tone-text muted">真实发布记录</span>
          </button>
          {lanes.map((lane) => {
            const laneCount = deploymentRecords.filter(
              (record) => record.environmentSlug === lane.slug,
            ).length;
            return (
              <button
                type="button"
                key={lane.id}
                className={environment === lane.slug ? 'release-lane active' : 'release-lane'}
                onClick={() => setEnvironment(lane.slug)}
              >
                <small>{lane.name}</small>
                <strong>{laneCount}</strong>
                <span className="tone-text muted">发布记录</span>
              </button>
            );
          })}
        </div>
      </section>
      <section className="panel release-list" aria-label="发布列表">
        <div className="filter-strip release-filter">
          <select
            value={environment}
            onChange={(event) => setEnvironment(event.currentTarget.value)}
            aria-label="环境筛选"
          >
            <option value="">全部环境</option>
            {lanes.map((lane) => (
              <option key={lane.id} value={lane.slug}>
                {lane.name}
              </option>
            ))}
          </select>
          <label className="search-field">
            <Search aria-hidden="true" />
            <input disabled value="" placeholder="搜索暂未接入" aria-label="发布搜索暂未接入" />
          </label>
          <button
            type="button"
            className="secondary-btn small-btn"
            disabled
            title="更多筛选暂未接入"
          >
            筛选已同步
          </button>
        </div>
        <RecordTable
          records={visibleDeployments}
          emptyText={`${environment || '全部环境'} 暂无真实发布记录`}
        />
        <GovernanceForm
          governanceKind={governanceKind}
          governanceName={governanceName}
          governanceStatus={governanceStatus}
          busyAction={busyAction}
          fixedKind="DEPLOYMENT"
          setGovernanceKind={setGovernanceKind}
          setGovernanceName={setGovernanceName}
          setGovernanceStatus={setGovernanceStatus}
          onCreateGovernanceRecord={onCreateGovernanceRecord}
        />
      </section>
      <aside className="panel inspector-panel release-detail">
        <PanelTitle title="发布详情" />
        {selectedDeployment ? (
          <dl className="project-info-list compact-info">
            <div>
              <dt>名称</dt>
              <dd>{selectedDeployment.name}</dd>
            </div>
            <div>
              <dt>环境</dt>
              <dd>{selectedDeployment.environmentSlug ?? 'all env'}</dd>
            </div>
            <div>
              <dt>状态</dt>
              <dd>{selectedDeployment.status}</dd>
            </div>
            <div>
              <dt>更新时间</dt>
              <dd>{formatFullDate(selectedDeployment.updatedAt)}</dd>
            </div>
          </dl>
        ) : (
          <div className="empty-state">暂无真实发布详情</div>
        )}
      </aside>
      <section className="panel release-quality">
        <PanelTitle title="发布质量" />
        <div className="metric-strip">
          <MetricTile
            icon={<Rocket aria-hidden="true" />}
            label="发布记录"
            value={deploymentRecords.length}
            detail="真实记录"
          />
          <MetricTile
            icon={<HeartPulse aria-hidden="true" />}
            label="可计算质量"
            value={deploymentRecords.length > 0 ? '已接入' : '暂无'}
            detail="基于真实发布"
          />
        </div>
      </section>
    </div>
  );
}

function CostWorkspace({
  detail,
  governanceDashboard,
}: {
  detail: ProjectDetailDTO | null;
  governanceDashboard: GovernanceDashboardDTO;
}) {
  const [range, setRange] = useState('本月');
  const costRecords = governanceDashboard.costRecords;
  return (
    <div className="workspace-view cost-board">
      <section className="cost-toolbar">
        <div className="segmented">
          {['本月', '30天', '季度'].map((item) => (
            <button
              type="button"
              key={item}
              className={range === item ? 'active' : ''}
              onClick={() => setRange(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <button type="button" className="secondary-btn small-btn" disabled title="导出暂未接入">
          导出
        </button>
        <button type="button" className="primary-btn small-btn" disabled title="预算配置暂未接入">
          配置预算
        </button>
      </section>
      <section className="metric-strip cost-kpis">
        <MetricTile
          icon={<WalletCards aria-hidden="true" />}
          label="本月成本"
          value={formatCents(governanceDashboard.summary.monthlyCostCents)}
          detail="真实汇总"
        />
        <MetricTile
          icon={<LineChart aria-hidden="true" />}
          label="预算使用"
          value="未接入"
          detail="暂无预算 API"
        />
        <MetricTile
          icon={<WalletCards aria-hidden="true" />}
          label="预测成本"
          value="未接入"
          detail="暂无预测 API"
        />
        <MetricTile icon={<Bell aria-hidden="true" />} label="异常" value={0} detail="较上月 0" />
        <MetricTile
          icon={<Server aria-hidden="true" />}
          label="最高成本服务"
          value={costRecords.length > 0 ? '已记录' : '-'}
          detail="基于真实成本记录"
        />
      </section>
      <section className="panel cost-trend">
        <PanelTitle title="成本趋势（¥）" />
        <div className="empty-state compact-empty">暂无真实成本趋势记录</div>
      </section>
      <section className="panel cost-distribution">
        <PanelTitle title="服务成本分布（本月）" />
        <div className="empty-state compact-empty">暂无真实服务成本分布</div>
      </section>
      <aside className="panel cost-side">
        <PanelTitle title="预算与使用" />
        <strong className="budget-number">预算未接入</strong>
        <div className="health-bar">
          <span style={{ width: '0%' }} />
        </div>
        <p>暂无真实预算配置 API。</p>
        <PanelTitle title="异常监控" />
        <div className="metric-strip dense-metrics">
          <MetricTile
            icon={<Bell aria-hidden="true" />}
            label="异常成本"
            value="0"
            detail="真实记录"
          />
          <MetricTile
            icon={<Server aria-hidden="true" />}
            label="突增服务"
            value="0"
            detail="真实记录"
          />
          <MetricTile
            icon={<LineChart aria-hidden="true" />}
            label="预算超额"
            value="未接入"
            detail="暂无预算"
          />
        </div>
      </aside>
      <section className="panel cost-detail">
        <PanelTitle
          title="成本归因明细"
          desc={detail ? `${detail.name} 的服务、环境和标签成本视图。` : '选择项目后查看成本。'}
        />
        <div className="filter-strip">
          {['全部服务', '全部环境', '全部资源类型', '全部标签'].map((item) => (
            <select key={item} defaultValue={item} aria-label={item}>
              <option>{item}</option>
            </select>
          ))}
          <label className="search-field">
            <Search aria-hidden="true" />
            <input disabled value="" placeholder="搜索暂未接入" aria-label="成本搜索暂未接入" />
          </label>
        </div>
        <div className="metric-strip">
          <MetricTile
            icon={<WalletCards aria-hidden="true" />}
            label="本月成本"
            value={formatCents(governanceDashboard.summary.monthlyCostCents)}
            detail={range}
          />
          <MetricTile
            icon={<LineChart aria-hidden="true" />}
            label="预算使用"
            value="未接入"
            detail="暂无预算"
          />
          <MetricTile icon={<Bell aria-hidden="true" />} label="异常" value={0} detail="成本异常" />
          <MetricTile
            icon={<Server aria-hidden="true" />}
            label="最高服务"
            value={costRecords.length > 0 ? '已记录' : '-'}
            detail="真实成本记录"
          />
        </div>
        <div className="table-wrap">
          <div className="data-table cost-table">
            <div className="data-row data-head">
              <span>服务</span>
              <span>环境</span>
              <span>类型</span>
              <span>状态</span>
              <span>更新时间</span>
            </div>
            {costRecords.length > 0 ? (
              costRecords.map((record) => (
                <div key={record.id} className="data-row">
                  <span>
                    <strong>{record.name}</strong>
                    <small>{record.serviceId ?? '-'}</small>
                  </span>
                  <span>{record.environmentSlug ?? 'all env'}</span>
                  <span>{record.kind}</span>
                  <span>{record.status}</span>
                  <span>{formatShortDate(record.updatedAt)}</span>
                </div>
              ))
            ) : (
              <div className="empty-state">暂无真实成本记录</div>
            )}
          </div>
        </div>
      </section>
      <section className="panel cost-suggestions">
        <PanelTitle title="优化建议" desc="仅基于真实成本记录生成。" />
        <div className="empty-state compact-empty">暂无真实成本优化建议</div>
        <RecordList records={costRecords} emptyText="暂无真实成本记录" />
      </section>
    </div>
  );
}

function AccessWorkspace({
  detail,
  members,
  credentials,
  newCredential,
  memberEmail,
  memberName,
  memberRole,
  credentialName,
  credentialServiceId,
  credentialEnvironmentSlug,
  busyAction,
  setMemberEmail,
  setMemberName,
  setMemberRole,
  setCredentialName,
  setCredentialServiceId,
  setCredentialEnvironmentSlug,
  onUpsertMember,
  onCreateCredential,
  onRotateCredential,
  onRevokeCredential,
}: {
  detail: ProjectDetailDTO | null;
  members: ProjectMemberDTO[];
  credentials: ServiceCredentialDTO[];
  newCredential: ServiceCredentialWithTokenDTO | null;
  memberEmail: string;
  memberName: string;
  memberRole: ProjectRole;
  credentialName: string;
  credentialServiceId: string;
  credentialEnvironmentSlug: string;
  busyAction: string | null;
  setMemberEmail: (value: string) => void;
  setMemberName: (value: string) => void;
  setMemberRole: (value: ProjectRole) => void;
  setCredentialName: (value: string) => void;
  setCredentialServiceId: (value: string) => void;
  setCredentialEnvironmentSlug: (value: string) => void;
  onUpsertMember: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onCreateCredential: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onRotateCredential: (credentialId: string) => Promise<void>;
  onRevokeCredential: (credentialId: string) => Promise<void>;
}) {
  const isActionBusy = (action: string) => busyAction === action;
  const credentialWithoutExpiry = credentials.filter((item) => !item.expiresAt).length;
  const accessRiskCount =
    (members.length === 0 ? 1 : 0) + (credentials.length === 0 ? 1 : 0) + credentialWithoutExpiry;
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return (
    <div className="workspace-view access-board">
      <section className="access-actions">
        <button
          type="button"
          className="secondary-btn small-btn"
          onClick={() => scrollToSection('access-member-form')}
        >
          <Users aria-hidden="true" />
          邀请成员
        </button>
        <button
          type="button"
          className="primary-btn small-btn"
          onClick={() => scrollToSection('access-credential-form')}
        >
          <KeyRound aria-hidden="true" />
          新增凭证
        </button>
        <button
          type="button"
          className="secondary-btn small-btn"
          disabled={credentials.length === 0}
          title={credentials.length === 0 ? '暂无凭证可轮换' : '在凭证库存中选择具体凭证轮换'}
          onClick={() => scrollToSection('access-credential-inventory')}
        >
          <RefreshCw aria-hidden="true" />
          轮换密钥
        </button>
      </section>
      <section className="metric-strip access-kpis">
        <MetricTile
          icon={<Users aria-hidden="true" />}
          label="成员"
          value={members.length}
          detail="较上月 -"
        />
        <MetricTile
          icon={<KeyRound aria-hidden="true" />}
          label="服务身份"
          value={credentials.length}
          detail="库存凭证"
        />
        <MetricTile
          icon={<Bell aria-hidden="true" />}
          label="即将过期凭证"
          value={credentials.filter((item) => item.expiresAt).length}
          detail="30 天内到期"
        />
        <MetricTile
          icon={<RefreshCw aria-hidden="true" />}
          label="最近轮换"
          value="暂无"
          detail="无真实轮换记录"
        />
        <MetricTile
          icon={<HeartPulse aria-hidden="true" />}
          label="权限风险"
          value={accessRiskCount}
          detail="基于成员/凭证"
        />
      </section>
      <section className="panel access-members" id="access-member-form" aria-label="成员权限">
        <PanelTitle
          title="成员权限"
          desc={detail ? `${detail.name} 的成员、角色和权限矩阵。` : '选择项目后管理成员。'}
        />
        <ul className="compact-list">
          {members.length > 0 ? (
            members.map((member) => (
              <li key={member.id}>
                <strong>{member.user.name}</strong>
                <span>{member.user.email}</span>
                <small>{member.role}</small>
              </li>
            ))
          ) : (
            <li>
              <strong>暂无成员</strong>
              <span>登录用户可通过表单写入成员权限</span>
              <small>-</small>
            </li>
          )}
        </ul>
        <form className="inline-form" onSubmit={(event) => void onUpsertMember(event)}>
          <input
            type="email"
            required
            value={memberEmail}
            onChange={(event) => setMemberEmail(event.currentTarget.value)}
            placeholder="member@example.com"
            aria-label="成员邮箱"
          />
          <input
            required
            value={memberName}
            onChange={(event) => setMemberName(event.currentTarget.value)}
            placeholder="成员名称"
            aria-label="成员名称"
          />
          <select
            value={memberRole}
            onChange={(event) => setMemberRole(event.currentTarget.value as ProjectRole)}
            aria-label="成员角色"
          >
            {projectRoles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="secondary-btn small-btn"
            disabled={!detail || isActionBusy('upsertMember')}
          >
            <Users aria-hidden="true" />
            {isActionBusy('upsertMember') ? '保存中' : '保存成员'}
          </button>
        </form>
      </section>

      <section className="panel permission-matrix" aria-label="角色权限矩阵">
        <PanelTitle title="角色权限矩阵" desc="基于角色的默认权限。" />
        <div className="data-table permission-table">
          <div className="data-row data-head">
            <span>权限类别</span>
            <span>Owner</span>
            <span>Maintainer</span>
            <span>Viewer</span>
          </div>
          {[
            ['项目', '完全访问', '读写', '只读'],
            ['服务', '完全访问', '读写', '只读'],
            ['环境', '完全访问', '读写', '只读'],
            ['发布', '完全访问', '读写', '只读'],
            ['凭证', '完全访问', '受限访问', '无访问'],
          ].map((row) => (
            <div className="data-row" key={row[0]}>
              {row.map((cell) => (
                <span key={cell}>{cell}</span>
              ))}
            </div>
          ))}
        </div>
      </section>

      <aside className="panel audit-timeline" aria-label="审计时间线">
        <PanelTitle title="审计时间线" />
        <div className="empty-state compact-empty">暂无真实审计事件</div>
      </aside>

      <section
        className="panel credential-inventory"
        id="access-credential-inventory"
        aria-label="服务凭证"
      >
        <PanelTitle title="凭证库存" desc="签发、轮换和吊销服务凭证。" />
        {newCredential ? (
          <div className="token-box">
            <strong>{newCredential.name}</strong>
            <code>{newCredential.token}</code>
          </div>
        ) : null}
        <div className="credential-list">
          {credentials.length > 0 ? (
            credentials.map((credential) => {
              const rotateBusy = isActionBusy(`rotateCredential:${credential.id}`);
              const revokeBusy = isActionBusy(`revokeCredential:${credential.id}`);
              return (
                <div key={credential.id} className="credential-row">
                  <span>
                    <strong>{credential.name}</strong>
                    <small>
                      {credential.environmentSlug} · {credential.status}
                    </small>
                  </span>
                  <button
                    type="button"
                    className="secondary-btn small-btn"
                    disabled={rotateBusy || revokeBusy}
                    onClick={() => void onRotateCredential(credential.id)}
                  >
                    <RefreshCw
                      aria-hidden="true"
                      className={rotateBusy ? 'spin-icon' : undefined}
                    />
                    {rotateBusy ? '轮换中' : '轮换'}
                  </button>
                  <button
                    type="button"
                    className="secondary-btn small-btn"
                    disabled={credential.status === 'REVOKED' || rotateBusy || revokeBusy}
                    onClick={() => void onRevokeCredential(credential.id)}
                  >
                    {revokeBusy ? '吊销中' : '吊销'}
                  </button>
                </div>
              );
            })
          ) : (
            <div className="empty-state compact-empty">暂无服务凭证，可使用下方表单签发。</div>
          )}
        </div>
        <form
          className="inline-form"
          id="access-credential-form"
          onSubmit={(event) => void onCreateCredential(event)}
        >
          <select
            required
            value={credentialServiceId}
            onChange={(event) => setCredentialServiceId(event.currentTarget.value)}
            aria-label="凭证服务"
          >
            <option value="">选择服务</option>
            {detail?.services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
          <select
            required
            value={credentialEnvironmentSlug}
            onChange={(event) => setCredentialEnvironmentSlug(event.currentTarget.value)}
            aria-label="凭证环境"
          >
            <option value="">选择环境</option>
            {detail?.environments.map((environment) => (
              <option key={environment.id} value={environment.slug}>
                {environment.name}
              </option>
            ))}
          </select>
          <input
            required
            value={credentialName}
            onChange={(event) => setCredentialName(event.currentTarget.value)}
            placeholder="web-local"
            aria-label="凭证名称"
          />
          <button
            type="submit"
            className="secondary-btn small-btn"
            disabled={!detail || isActionBusy('createCredential')}
          >
            <KeyRound aria-hidden="true" />
            {isActionBusy('createCredential') ? '签发中' : '签发凭证'}
          </button>
        </form>
      </section>
      <aside className="panel risk-suggestion-panel">
        <PanelTitle title="风险建议" />
        {accessRiskCount > 0 ? (
          <ul className="quality-list">
            {members.length === 0 ? (
              <QualityItem label="暂无真实成员记录" value={1} tone="warning" />
            ) : null}
            {credentials.length === 0 ? (
              <QualityItem label="暂无服务凭证" value={1} tone="warning" />
            ) : null}
            {credentialWithoutExpiry > 0 ? (
              <QualityItem
                label="凭证未设置过期时间"
                value={credentialWithoutExpiry}
                tone="neutral"
              />
            ) : null}
          </ul>
        ) : (
          <div className="empty-state compact-empty">暂无基于真实数据的风险建议</div>
        )}
      </aside>
    </div>
  );
}

function IntegrationWorkspace({
  hasSession,
  form,
  manifest,
  manifestResult,
  applyResult,
  busyAction,
  setForm,
  setManifest,
  onCreateProject,
  onValidateManifest,
  onApplyManifest,
}: {
  hasSession: boolean;
  form: ProjectFormState;
  manifest: string;
  manifestResult: ManifestValidationResult | null;
  applyResult: ManifestApplyResult | null;
  busyAction: string | null;
  setForm: (value: ProjectFormState) => void;
  setManifest: (value: string) => void;
  onCreateProject: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onValidateManifest: () => Promise<void>;
  onApplyManifest: () => Promise<void>;
}) {
  return (
    <div className={hasSession ? 'workspace-view integration-grid' : 'workspace-view muted-grid'}>
      <section className="panel" aria-label="接入向导">
        <PanelTitle
          title="Manjv Studio 接入向导"
          desc="默认使用 http://localhost:3100 和本地仓库路径。"
        />
        <ol className="step-list">
          <li className="active">
            <strong>1 项目信息</strong>
            <span>名称、类型、负责人、标签</span>
          </li>
          <li className="active">
            <strong>2 运行地址</strong>
            <span>http://localhost:3100</span>
          </li>
          <li>
            <strong>3 服务探测</strong>
            <span>生成端点和健康检查</span>
          </li>
          <li>
            <strong>4 治理清单</strong>
            <span>写入目录、服务和环境</span>
          </li>
        </ol>
        <form onSubmit={(event) => void onCreateProject(event)}>
          <fieldset className="form-grid" disabled={!hasSession || busyAction === 'createProject'}>
            <label>
              Slug
              <input
                required
                value={form.slug}
                onChange={(event) => setForm({ ...form, slug: event.currentTarget.value })}
                placeholder="manjv-studio"
                aria-label="项目 Slug"
              />
            </label>
            <label>
              名称
              <input
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.currentTarget.value })}
                placeholder="Manjv Studio"
                aria-label="项目名称"
              />
            </label>
            <label>
              类型
              <select
                value={form.type}
                onChange={(event) =>
                  setForm({ ...form, type: event.currentTarget.value as ProjectType })
                }
                aria-label="项目类型"
              >
                {projectTypes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label>
              负责人
              <input
                required
                value={form.ownerName}
                onChange={(event) => setForm({ ...form, ownerName: event.currentTarget.value })}
                placeholder="XueGang-AI"
                aria-label="项目负责人"
              />
            </label>
            <label>
              邮箱
              <input
                type="email"
                value={form.ownerEmail}
                onChange={(event) => setForm({ ...form, ownerEmail: event.currentTarget.value })}
                placeholder="example@example.com"
                aria-label="负责人邮箱"
              />
            </label>
            <label>
              仓库
              <input
                value={form.repositoryUrl}
                onChange={(event) => setForm({ ...form, repositoryUrl: event.currentTarget.value })}
                placeholder="file:///Users/xuegang/Desktop/My Project/manjv-studio"
                aria-label="项目仓库"
              />
            </label>
            <label>
              文档
              <input
                value={form.documentationUrl}
                onChange={(event) =>
                  setForm({ ...form, documentationUrl: event.currentTarget.value })
                }
                placeholder="http://localhost:3100"
                aria-label="项目文档"
              />
            </label>
            <label>
              标签
              <input
                value={form.tags}
                onChange={(event) => setForm({ ...form, tags: event.currentTarget.value })}
                placeholder="domain:ai-video,language:typescript,runtime:nextjs"
                aria-label="项目标签"
              />
            </label>
            <button type="submit" className="primary-btn">
              <Plus aria-hidden="true" />
              {busyAction === 'createProject' ? '创建中' : '创建项目'}
            </button>
          </fieldset>
        </form>
      </section>

      <section className="panel" aria-label="Manifest 接入">
        <PanelTitle
          title="Manifest 接入"
          desc="推荐使用 project.yaml 接入并同步服务、环境和端点。"
        />
        <textarea
          className="manifest-editor"
          value={manifest}
          disabled={busyAction === 'validateManifest' || busyAction === 'applyManifest'}
          onChange={(event) => setManifest(event.currentTarget.value)}
          spellCheck={false}
          aria-label="Manifest YAML"
        />
        <div className="button-row">
          <button
            type="button"
            className="secondary-btn"
            disabled={busyAction === 'validateManifest' || busyAction === 'applyManifest'}
            onClick={() => void onValidateManifest()}
          >
            <FileCode2 aria-hidden="true" />
            {busyAction === 'validateManifest' ? '校验中' : '校验'}
          </button>
          <button
            type="button"
            className="primary-btn"
            disabled={
              !hasSession || busyAction === 'validateManifest' || busyAction === 'applyManifest'
            }
            onClick={() => void onApplyManifest()}
          >
            <UploadCloud aria-hidden="true" />
            {busyAction === 'applyManifest' ? '应用中' : '应用'}
          </button>
        </div>
        <ManifestResult validation={manifestResult} applied={applyResult} />
      </section>
    </div>
  );
}

function ObservabilityWorkspace({
  detail,
  observabilityLinks,
  observabilityTitle,
  observabilityUrl,
  observabilitySignal,
  busyAction,
  setObservabilityTitle,
  setObservabilityUrl,
  setObservabilitySignal,
  onCreateObservabilityLink,
}: {
  detail: ProjectDetailDTO | null;
  observabilityLinks: ObservabilityLinkDTO[];
  observabilityTitle: string;
  observabilityUrl: string;
  observabilitySignal: ObservabilitySignal;
  busyAction: string | null;
  setObservabilityTitle: (value: string) => void;
  setObservabilityUrl: (value: string) => void;
  setObservabilitySignal: (value: ObservabilitySignal) => void;
  onCreateObservabilityLink: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  const [range, setRange] = useState('1h');
  const signalCount = (signal: ObservabilitySignal) =>
    observabilityLinks.filter((link) => link.signal === signal).length;
  return (
    <div className="workspace-view observability-grid">
      <section className="panel">
        <PanelTitle
          title={detail ? `${detail.name} 观测看板` : '观测看板'}
          desc="指标、日志、Trace 和观测入口集中在同一页。"
        />
        <div className="segmented">
          {['15m', '1h', '24h'].map((item) => (
            <button
              type="button"
              key={item}
              className={range === item ? 'active' : ''}
              onClick={() => setRange(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="metric-strip">
          <MetricTile
            icon={<LineChart aria-hidden="true" />}
            label="Metrics"
            value={signalCount('METRICS')}
            detail={`真实链接 · ${range}`}
          />
          <MetricTile
            icon={<FileCode2 aria-hidden="true" />}
            label="Logs"
            value={signalCount('LOGS')}
            detail="真实链接"
          />
          <MetricTile
            icon={<GitBranch aria-hidden="true" />}
            label="Traces"
            value={signalCount('TRACES')}
            detail="真实链接"
          />
          <MetricTile
            icon={<Server aria-hidden="true" />}
            label="Dashboard"
            value={signalCount('DASHBOARD')}
            detail="真实链接"
          />
        </div>
        <div className="empty-state compact-empty">暂无真实观测指标流；请添加项目观测链接。</div>
      </section>
      <aside className="panel">
        <PanelTitle title="观测入口" desc="仅展示已写入平台的真实链接。" />
        <RecordLinks links={observabilityLinks} />
      </aside>
      <section className="panel">
        <PanelTitle title="项目观测链接" desc="把项目级观测、日志和 Trace 链接写回平台。" />
        <RecordLinks links={observabilityLinks} />
        <form className="inline-form" onSubmit={(event) => void onCreateObservabilityLink(event)}>
          <select
            value={observabilitySignal}
            onChange={(event) =>
              setObservabilitySignal(event.currentTarget.value as ObservabilitySignal)
            }
            aria-label="可观测性类型"
          >
            {observabilitySignals.map((signal) => (
              <option key={signal} value={signal}>
                {signal}
              </option>
            ))}
          </select>
          <input
            required
            value={observabilityTitle}
            onChange={(event) => setObservabilityTitle(event.currentTarget.value)}
            placeholder="观测平台链接名称"
            aria-label="可观测性标题"
          />
          <input
            type="url"
            required
            value={observabilityUrl}
            onChange={(event) => setObservabilityUrl(event.currentTarget.value)}
            placeholder="https://example.com/observability/..."
            aria-label="可观测性链接"
          />
          <button
            type="submit"
            className="secondary-btn small-btn"
            disabled={!detail || busyAction === 'createObservabilityLink'}
          >
            <Plus aria-hidden="true" />
            {busyAction === 'createObservabilityLink' ? '添加中' : '添加'}
          </button>
        </form>
      </section>
    </div>
  );
}

function PanelTitle({
  title,
  desc,
  actionLabel,
  onAction,
  href,
}: {
  title: string;
  desc?: string;
  actionLabel?: string;
  onAction?: () => void;
  href?: string;
}) {
  return (
    <div className="panel-title">
      <div>
        <h3>{title}</h3>
        {desc ? <p>{desc}</p> : null}
      </div>
      {href ? (
        <a className="text-link" href={href} target="_blank" rel="noreferrer">
          {actionLabel}
          <ArrowRight aria-hidden="true" />
        </a>
      ) : null}
      {onAction ? (
        <button type="button" className="text-button" onClick={onAction}>
          {actionLabel}
          <ArrowRight aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

function MetricTile({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  detail: string;
}) {
  return (
    <article className="metric-tile">
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <strong title={typeof value === 'string' ? value : undefined}>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function ProjectMetaLine({ detail }: { detail: ProjectDetailDTO }) {
  return (
    <div className="project-meta-line">
      <span>
        <GitBranch aria-hidden="true" />
        {detail.repositoryUrl ?? '未配置仓库'}
      </span>
      {detail.tags.slice(0, 5).map((tag) => (
        <span key={tag} className="tag-chip">
          {tag}
        </span>
      ))}
    </div>
  );
}

function ServiceMatrix({
  detail,
  compact = false,
}: {
  detail: ProjectDetailDTO | null;
  compact?: boolean;
}) {
  if (!detail) {
    return <div className="empty-state">选择项目后查看服务矩阵</div>;
  }
  return (
    <div className={compact ? 'service-matrix compact' : 'service-matrix'}>
      {detail.services.map((service) => {
        const endpoints = endpointsForService(detail, service.id);
        const health = serviceHealth(endpoints);
        return (
          <article key={service.id} className="matrix-node">
            <span className="node-icon">
              <Server aria-hidden="true" />
            </span>
            <div>
              <strong>{service.name}</strong>
              <small>
                {service.type} · {environmentSummary(detail, endpoints)}
              </small>
            </div>
            <HealthRatio healthy={health.healthy} total={health.total} />
          </article>
        );
      })}
    </div>
  );
}

function ServiceHealthTable({ detail }: { detail: ProjectDetailDTO | null }) {
  if (!detail) {
    return <div className="empty-state">选择项目后查看服务健康矩阵</div>;
  }
  return (
    <div className="table-wrap">
      <div className="data-table service-health-table">
        <div className="data-row data-head">
          <span>服务</span>
          <span>类型</span>
          <span>端点健康</span>
          <span>环境</span>
          <span>异常节点</span>
          <span>最新检测</span>
          <span>状态</span>
        </div>
        {detail.services.map((service) => {
          const endpoints = endpointsForService(detail, service.id);
          const health = serviceHealth(endpoints);
          const latest = endpoints
            .map((endpoint) => endpoint.lastCheckedAt)
            .filter(Boolean)
            .sort()
            .at(-1);
          return (
            <div className="data-row" key={service.id}>
              <span>
                <strong>{service.name}</strong>
                <small>{service.slug}</small>
              </span>
              <span>{service.type}</span>
              <span>
                <HealthRatio healthy={health.healthy} total={health.total} />
              </span>
              <span>{environmentSummary(detail, endpoints)}</span>
              <span>{health.down}</span>
              <span>{formatShortDate(latest)}</span>
              <span>
                <StatusBadge status={serviceStatusTone(endpoints)} />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReleaseMiniTable({ records }: { records: GovernanceRecordDTO[] }) {
  return (
    <div className="table-wrap">
      <div className="data-table release-mini-table">
        <div className="data-row data-head">
          <span>服务</span>
          <span>版本/变更</span>
          <span>环境</span>
          <span>发布人</span>
          <span>时间</span>
          <span>状态</span>
        </div>
        {records.length > 0 ? (
          records.slice(0, 4).map((record) => (
            <div className="data-row" key={record.id}>
              <span>{record.serviceId ?? '-'}</span>
              <span>
                <strong>{record.name}</strong>
                <small>{record.kind}</small>
              </span>
              <span>{record.environmentSlug ?? 'all env'}</span>
              <span>-</span>
              <span>{formatShortDate(record.updatedAt)}</span>
              <span>
                <span className="status-pill status-active">{record.status}</span>
              </span>
            </div>
          ))
        ) : (
          <div className="empty-state">暂无真实发布记录</div>
        )}
      </div>
    </div>
  );
}

function EndpointTable({
  detail,
  busyAction,
  onCheckEndpoint,
}: {
  detail: ProjectDetailDTO | null;
  busyAction: string | null;
  onCheckEndpoint: (endpointId: string) => Promise<void>;
}) {
  if (!detail) {
    return <div className="empty-state">选择项目后查看端点</div>;
  }
  return (
    <div className="table-wrap">
      <div className="data-table endpoint-table">
        <div className="data-row data-head">
          <span>端点</span>
          <span>服务</span>
          <span>状态</span>
          <span>P95</span>
          <span>最后检测</span>
          <span>操作</span>
        </div>
        {detail.endpoints.map((endpoint) => {
          const endpointBusy = busyAction === `checkEndpoint:${endpoint.id}`;
          const service = detail.services.find((item) => item.id === endpoint.serviceId);
          return (
            <div key={endpoint.id} className="data-row">
              <span>
                <strong>{endpoint.baseUrl}</strong>
                <small>{endpoint.healthCheckPath ?? '/'}</small>
              </span>
              <span>{service?.name ?? '-'}</span>
              <span>
                <StatusBadge status={healthTone(endpoint.lastHealthStatus)} />
              </span>
              <span>{endpoint.lastLatencyMs !== null ? `${endpoint.lastLatencyMs}ms` : '-'}</span>
              <span>{formatShortDate(endpoint.lastCheckedAt)}</span>
              <span>
                <button
                  type="button"
                  className="secondary-btn small-btn"
                  disabled={!endpoint.healthCheckEnabled || endpointBusy}
                  onClick={() => void onCheckEndpoint(endpoint.id)}
                >
                  <ClipboardCheck aria-hidden="true" />
                  {endpointBusy ? '检测中' : '检测'}
                </button>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EndpointList({
  endpoints,
  busyAction,
  onCheckEndpoint,
}: {
  endpoints: ServiceEndpointDTO[];
  busyAction: string | null;
  onCheckEndpoint: () => Promise<void>;
}) {
  if (endpoints.length === 0) {
    return <div className="empty-state compact-empty">暂无端点</div>;
  }
  return (
    <ul className="endpoint-list">
      {endpoints.map((endpoint) => (
        <li key={endpoint.id}>
          <span>
            <strong>{endpoint.baseUrl}</strong>
            <small>{endpoint.healthCheckPath ?? '/'}</small>
          </span>
          <StatusBadge status={healthTone(endpoint.lastHealthStatus)} />
          <button
            type="button"
            className="secondary-btn small-btn"
            disabled={!endpoint.healthCheckEnabled || busyAction?.startsWith('checkEndpoint:')}
            onClick={() => void onCheckEndpoint()}
          >
            检测
          </button>
        </li>
      ))}
    </ul>
  );
}

function GovernanceForm({
  governanceKind,
  governanceName,
  governanceStatus,
  busyAction,
  fixedKind,
  setGovernanceKind,
  setGovernanceName,
  setGovernanceStatus,
  onCreateGovernanceRecord,
}: {
  governanceKind: GovernanceRecordKind;
  governanceName: string;
  governanceStatus: string;
  busyAction: string | null;
  fixedKind?: GovernanceRecordKind;
  setGovernanceKind: (value: GovernanceRecordKind) => void;
  setGovernanceName: (value: string) => void;
  setGovernanceStatus: (value: string) => void;
  onCreateGovernanceRecord: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  useEffect(() => {
    if (fixedKind) {
      setGovernanceKind(fixedKind);
    }
  }, [fixedKind, setGovernanceKind]);

  return (
    <form className="inline-form" onSubmit={(event) => void onCreateGovernanceRecord(event)}>
      <select
        value={fixedKind ?? governanceKind}
        disabled={Boolean(fixedKind)}
        onChange={(event) => setGovernanceKind(event.currentTarget.value as GovernanceRecordKind)}
        aria-label="治理类型"
      >
        {governanceKinds.map((kind) => (
          <option key={kind} value={kind}>
            {kind}
          </option>
        ))}
      </select>
      <input
        required
        value={governanceName}
        onChange={(event) => setGovernanceName(event.currentTarget.value)}
        placeholder="API 错误率告警"
        aria-label="治理记录名称"
      />
      <input
        required
        value={governanceStatus}
        onChange={(event) => setGovernanceStatus(event.currentTarget.value)}
        placeholder="ACTIVE"
        aria-label="治理记录状态"
      />
      <button
        type="submit"
        className="secondary-btn small-btn"
        disabled={busyAction === 'createGovernanceRecord'}
      >
        <Plus aria-hidden="true" />
        {busyAction === 'createGovernanceRecord' ? '创建中' : '创建记录'}
      </button>
    </form>
  );
}

function RecordTable({
  records,
  emptyText,
}: {
  records: GovernanceRecordDTO[];
  emptyText: string;
}) {
  return (
    <div className="table-wrap">
      <div className="data-table records-table">
        <div className="data-row data-head">
          <span>类型</span>
          <span>名称</span>
          <span>状态</span>
          <span>环境</span>
          <span>更新时间</span>
        </div>
        {records.length > 0 ? (
          records.map((record) => (
            <div key={record.id} className="data-row">
              <span>{record.kind}</span>
              <span>
                <strong>{record.name}</strong>
                <small>{record.serviceId ?? '-'}</small>
              </span>
              <span>
                <span className="status-pill">{record.status}</span>
              </span>
              <span>{record.environmentSlug ?? 'all env'}</span>
              <span>{formatShortDate(record.updatedAt)}</span>
            </div>
          ))
        ) : (
          <div className="empty-state">{emptyText}</div>
        )}
      </div>
    </div>
  );
}

function RecordList({ records, emptyText }: { records: GovernanceRecordDTO[]; emptyText: string }) {
  if (records.length === 0) {
    return <div className="empty-state compact-empty">{emptyText}</div>;
  }
  return (
    <ul className="record-list">
      {records.map((record) => (
        <li key={record.id}>
          <span className="status-pill">{record.status}</span>
          <strong>{record.name}</strong>
          <small>
            {record.kind} · {formatShortDate(record.updatedAt)}
          </small>
        </li>
      ))}
    </ul>
  );
}

function RecordLinks({ links }: { links: ObservabilityLinkDTO[] }) {
  if (links.length === 0) {
    return <div className="empty-state compact-empty">暂无项目观测链接</div>;
  }
  return (
    <div className="link-list">
      {links.map((link) => (
        <a key={link.id} href={link.url} target="_blank" rel="noreferrer">
          <span className="status-pill">{link.signal}</span>
          <strong>{link.title}</strong>
          <small>{link.environmentSlug ?? 'all env'}</small>
        </a>
      ))}
    </div>
  );
}

function QualityItem({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <li data-tone={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
    </li>
  );
}

function ExplorerGroup({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="explorer-group" aria-label={title}>
      <h3>
        <span>{title}</span>
        <small>{count}</small>
      </h3>
      <div>{children}</div>
    </section>
  );
}

function HealthRatio({ healthy, total }: { healthy: number; total: number }) {
  const ratio = total > 0 ? Math.round((healthy / total) * 100) : 0;
  const tone =
    total === 0 ? 'unknown' : healthy === total ? 'ok' : healthy > 0 ? 'warning' : 'danger';
  return (
    <span className="health-ratio" data-tone={tone}>
      <span className="health-bar" aria-hidden="true">
        <span style={{ width: `${ratio}%` }} />
      </span>
      <strong>
        {healthy}/{total}
      </strong>
    </span>
  );
}

function ManifestResult({
  validation,
  applied,
}: {
  validation: ManifestValidationResult | null;
  applied: ManifestApplyResult | null;
}) {
  if (!validation && !applied) {
    return null;
  }
  return (
    <div className="manifest-result">
      {validation ? (
        <div>
          <strong>{validation.valid ? '校验通过' : '校验失败'}</strong>
          {validation.errors.length > 0 ? (
            <ul>
              {validation.errors.map((error) => (
                <li key={`${error.path}-${error.message}`}>
                  {error.path}: {error.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {applied ? (
        <div>
          <strong>已应用 {applied.projectSlug}</strong>
          <p>
            创建 {applied.summary.created.projects + applied.summary.created.services} 项，更新{' '}
            {applied.summary.updated.projects + applied.summary.updated.services} 项
          </p>
        </div>
      ) : null}
    </div>
  );
}

function EmptyWorkspace({ text }: { text: string }) {
  return (
    <div className="workspace-view">
      <section className="panel">
        <div className="empty-state">{text}</div>
      </section>
    </div>
  );
}

function endpointsForService(detail: ProjectDetailDTO, serviceId: string): ServiceEndpointDTO[] {
  return detail.endpoints.filter((endpoint) => endpoint.serviceId === serviceId);
}

function serviceHealth(endpoints: ServiceEndpointDTO[]): {
  healthy: number;
  total: number;
  down: number;
} {
  return {
    healthy: endpoints.filter((endpoint) => endpoint.lastHealthStatus === 'HEALTHY').length,
    total: endpoints.length,
    down: endpoints.filter((endpoint) => endpoint.lastHealthStatus === 'UNHEALTHY').length,
  };
}

function projectHealth(detail: ProjectDetailDTO): { healthy: number; total: number; down: number } {
  return serviceHealth(detail.endpoints);
}

function serviceStatusTone(endpoints: ServiceEndpointDTO[]): ProbeStatus {
  if (endpoints.length === 0) return 'loading';
  if (endpoints.some((endpoint) => endpoint.lastHealthStatus === 'UNHEALTHY')) return 'down';
  if (endpoints.every((endpoint) => endpoint.lastHealthStatus === 'HEALTHY')) return 'ok';
  return 'loading';
}

function environmentSummary(detail: ProjectDetailDTO, endpoints: ServiceEndpointDTO[]): string {
  const names = endpoints.flatMap((endpoint) => {
    const environment = detail.environments.find((item) => item.id === endpoint.environmentId);
    return environment ? [environment.name] : [];
  });
  const uniqueNames = Array.from(new Set(names));
  if (uniqueNames.length === 0) return '-';
  if (uniqueNames.length <= 2) return uniqueNames.join(' / ');
  return `${uniqueNames.slice(0, 2).join(' / ')} +${uniqueNames.length - 2}`;
}

function primaryEnvironmentName(detail: ProjectDetailDTO | null): string {
  return (
    detail?.environments.find((environment) => environment.slug === 'local')?.name ??
    detail?.environments[0]?.name ??
    '本地开发'
  );
}

function averageLatency(endpoints: ServiceEndpointDTO[]): string {
  const values = endpoints
    .map((endpoint) => endpoint.lastLatencyMs)
    .filter((value): value is number => typeof value === 'number');
  if (values.length === 0) return '-';
  return `${Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)}ms`;
}

function scoreLabel(health: { healthy: number; total: number }): string {
  if (health.total === 0) return '0';
  return String(Math.round((health.healthy / health.total) * 100));
}

function loadStateLabel(state: LoadState): string {
  if (state === 'loading') return '加载中';
  if (state === 'ready') return '已同步';
  if (state === 'error') return '同步失败';
  return '待登录';
}

function formatCents(value: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 2,
  }).format(value / 100);
}

function formatShortDate(value: string | null | undefined): string {
  if (!value) return '暂无';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '暂无';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatFullDate(value: string | null | undefined): string {
  if (!value) return '暂无';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '暂无';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function healthTone(status: string): ProbeStatus {
  if (status === 'HEALTHY') return 'ok';
  if (status === 'UNHEALTHY') return 'down';
  return 'loading';
}

function emptyGovernanceDashboard(): GovernanceDashboardDTO {
  return {
    summary: {
      activeAlerts: 0,
      openDeployments: 0,
      monthlyCostCents: 0,
      activeModelRoutes: 0,
      configurationItems: 0,
      secretReferences: 0,
    },
    alerts: [],
    deployments: [],
    configurations: [],
    secretReferences: [],
    costRecords: [],
    modelRoutes: [],
    tasks: [],
    promptEvaluations: [],
  };
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiClientError) {
    return err.code ? `${err.code}: ${err.message}` : err.message;
  }
  return err instanceof Error ? err.message : '操作失败';
}

function isAuthError(err: unknown): boolean {
  return (
    err instanceof ApiClientError &&
    (err.status === 401 || err.code === 'AUTH_TOKEN_INVALID' || err.code === 'AUTH_REQUIRED')
  );
}
