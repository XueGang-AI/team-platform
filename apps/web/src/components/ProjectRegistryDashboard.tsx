'use client';

import { FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import type {
  CreateProjectBody,
  GovernanceDashboardDTO,
  ManifestApplyResult,
  ManifestValidationResult,
  GovernanceRecordDTO,
  GovernanceRecordKind,
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
  UserDTO,
} from '@team-platform/contracts';
import {
  ApiClientError,
  applyManifest,
  checkEndpoint,
  createGovernanceRecord,
  createObservabilityLink,
  createCredential,
  createProject,
  getProject,
  getGovernanceDashboard,
  listCredentials,
  listObservabilityLinks,
  listMembers,
  login,
  listProjects,
  revokeCredential,
  rotateCredential,
  upsertMember,
  validateManifest,
} from '@/lib/project-registry';
import type { ProbeStatus } from '@/lib/api-health';
import { StatusBadge } from '@/components/StatusBadge';
import {
  Bell,
  ClipboardCheck,
  Cloud,
  FileCode2,
  KeyRound,
  LineChart,
  Plus,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
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
const observabilitySignals: ObservabilitySignal[] = ['LOGS', 'METRICS', 'TRACES', 'DASHBOARD'];
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

const defaultManifest = `apiVersion: team-platform.io/v1alpha1
kind: Project

metadata:
  slug: team-platform
  name: 团队统一项目治理平台
  labels:
    category: platform
    language: typescript

spec:
  type: INTERNAL_TOOL
  owner:
    name: XueGang-AI
    email: example@example.com
  repository:
    url: git@github.com:XueGang-AI/team-platform.git
  services:
    - slug: web
      name: 管理后台
      type: WEB
    - slug: api
      name: 平台 API
      type: API
  environments:
    - slug: dev
      name: 开发环境
  endpoints:
    - service: web
      environment: dev
      baseUrl: http://localhost:3000
      healthCheck:
        enabled: false
    - service: api
      environment: dev
      baseUrl: http://localhost:3001
      healthCheck:
        enabled: true
        path: /health/ready
`;

interface ProjectRegistryDashboardProps {
  apiBaseUrl: string;
}

type LoadState = 'idle' | 'loading' | 'ready' | 'error';
type DetailTab = 'overview' | 'services' | 'governance' | 'security' | 'integration';

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

function emptyForm(): ProjectFormState {
  return {
    slug: '',
    name: '',
    type: 'API_SERVICE',
    ownerName: '',
    ownerEmail: '',
    repositoryUrl: '',
    documentationUrl: '',
    tags: '',
  };
}

export function ProjectRegistryDashboard({ apiBaseUrl }: ProjectRegistryDashboardProps) {
  const [projects, setProjects] = useState<PagedResult<ProjectDTO> | null>(null);
  const [selected, setSelected] = useState<ProjectDetailDTO | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ProjectStatus | ''>('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
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
    () => ({ page: 1, pageSize: 20, search, status: status || undefined, includeArchived }),
    [includeArchived, search, status],
  );
  const governance = governanceDashboard ?? emptyGovernanceDashboard();
  const summary = useMemo(() => {
    const projectItems = projects?.items ?? [];
    const endpoints = selected?.endpoints ?? [];
    const downEndpoints = endpoints.filter((endpoint) => endpoint.lastHealthStatus === 'UNHEALTHY');
    const healthyEndpoints = endpoints.filter(
      (endpoint) => endpoint.lastHealthStatus === 'HEALTHY',
    );

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
    };
  }, [
    credentials.length,
    governance.summary.activeAlerts,
    governance.summary.monthlyCostCents,
    projects,
    selected,
  ]);

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
      setError(errorMessage(err));
    }
  }

  async function selectProject(slug: string) {
    try {
      const detail = await getProject(apiBaseUrl, slug, token);
      setSelected(detail);
      if (token) {
        const [projectMembers, projectCredentials, links, governance] = await Promise.all([
          listMembers(apiBaseUrl, slug, token),
          listCredentials(apiBaseUrl, slug, token),
          listObservabilityLinks(apiBaseUrl, slug, token),
          getGovernanceDashboard(apiBaseUrl, slug, token),
        ]);
        setMembers(projectMembers);
        setCredentials(projectCredentials);
        setObservabilityLinks(links);
        setGovernanceDashboard(governance);
      }
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function onCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
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
    try {
      const created = await createProject(apiBaseUrl, body, token);
      setForm(emptyForm());
      await refreshProjects(created.slug);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function onValidateManifest() {
    setError(null);
    setApplyResult(null);
    try {
      const result = await validateManifest(apiBaseUrl, manifest);
      setManifestResult(result);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function onApplyManifest() {
    setError(null);
    try {
      const result = await applyManifest(apiBaseUrl, manifest, token);
      setApplyResult(result);
      await refreshProjects(result.projectSlug);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function onCheckEndpoint(endpointId: string) {
    if (!selected) return;
    setError(null);
    try {
      await checkEndpoint(apiBaseUrl, selected.slug, endpointId, token);
      await selectProject(selected.slug);
    } catch (err) {
      setError(errorMessage(err));
      await selectProject(selected.slug);
    }
  }

  async function onUpsertMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setError(null);
    try {
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
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function onCreateCredential(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setError(null);
    try {
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
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function onRotateCredential(credentialId: string) {
    if (!selected) return;
    setError(null);
    try {
      const credential = await rotateCredential(apiBaseUrl, selected.slug, credentialId, token);
      setNewCredential(credential);
      await selectProject(selected.slug);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function onRevokeCredential(credentialId: string) {
    if (!selected) return;
    setError(null);
    try {
      await revokeCredential(apiBaseUrl, selected.slug, credentialId, token);
      await selectProject(selected.slug);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function onCreateObservabilityLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setError(null);
    try {
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
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function onCreateGovernanceRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setError(null);
    try {
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
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function onLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      const result = await login(apiBaseUrl, loginEmail, loginName);
      setToken(result.token);
      setUser(result.user);
      window.localStorage.setItem('team-platform-token', result.token);
      window.localStorage.setItem('team-platform-user', JSON.stringify(result.user));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function logout() {
    setToken(null);
    setUser(null);
    setProjects(null);
    setSelected(null);
    setGovernanceDashboard(null);
    window.localStorage.removeItem('team-platform-token');
    window.localStorage.removeItem('team-platform-user');
  }

  useEffect(() => {
    void refreshProjects();
    // query intentionally drives refreshes; selectProject reads selected only for continuity.
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
      <header id="overview" className="workspace-header portal-header">
        <div>
          <p className="eyebrow">Platform Control Plane</p>
          <h2 id="registry-title">工程治理总览</h2>
          <p>服务目录、负责人、环境、健康、告警、发布、成本与接入能力集中管理。</p>
        </div>
        {user ? (
          <div className="session-bar">
            <span>{user.email}</span>
            <button type="button" className="secondary-btn" onClick={() => void refreshProjects()}>
              <RefreshCw aria-hidden="true" />
              刷新
            </button>
            <button type="button" className="secondary-btn" onClick={logout}>
              退出
            </button>
          </div>
        ) : null}
      </header>

      {error ? <div className="alert">{error}</div> : null}

      {!token ? (
        <section className="panel login-panel portal-login" aria-label="登录">
          <div>
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
                onChange={(event) => setLoginEmail(event.currentTarget.value)}
              />
            </label>
            <label>
              名称
              <input
                required
                value={loginName}
                onChange={(event) => setLoginName(event.currentTarget.value)}
              />
            </label>
            <button type="submit" className="primary-btn">
              <KeyRound aria-hidden="true" />
              登录
            </button>
          </form>
        </section>
      ) : null}

      <section className={token ? 'summary-grid' : 'summary-grid disabled-grid'}>
        <MetricCard
          icon={<Server aria-hidden="true" />}
          label="项目"
          value={summary.totalProjects}
          detail={`${summary.activeProjects} active`}
        />
        <MetricCard
          icon={<Cloud aria-hidden="true" />}
          label="服务 / 环境"
          value={`${summary.serviceCount}/${summary.environmentCount}`}
          detail={selected?.name ?? '选择项目后查看'}
        />
        <MetricCard
          icon={<ClipboardCheck aria-hidden="true" />}
          label="健康端点"
          value={`${summary.healthyEndpointCount}/${summary.endpointCount}`}
          detail={summary.downEndpointCount > 0 ? `${summary.downEndpointCount} down` : '无异常'}
        />
        <MetricCard
          icon={<Bell aria-hidden="true" />}
          label="活跃告警"
          value={summary.activeAlerts}
          detail="来自治理记录"
        />
        <MetricCard
          icon={<WalletCards aria-hidden="true" />}
          label="月成本"
          value={formatCents(summary.monthlyCostCents)}
          detail="按项目聚合"
        />
        <MetricCard
          icon={<ShieldCheck aria-hidden="true" />}
          label="凭证"
          value={summary.credentials}
          detail="服务身份"
        />
      </section>

      <div className={token ? 'portal-grid' : 'portal-grid disabled-grid'}>
        <section id="catalog" className="panel catalog-panel" aria-label="项目目录">
          <header className="panel-header catalog-header">
            <div>
              <h2>项目目录</h2>
              <p className="panel-desc">
                {loadState === 'loading' ? '加载中' : `共 ${projects?.total ?? 0} 个项目`}
              </p>
            </div>
            <div className="toolbar catalog-toolbar">
              <label className="search-field">
                <Search aria-hidden="true" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.currentTarget.value)}
                  placeholder="搜索项目、负责人、标签"
                  aria-label="搜索项目"
                />
              </label>
              <select
                value={status}
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
                  onChange={(event) => setIncludeArchived(event.currentTarget.checked)}
                />
                归档
              </label>
            </div>
          </header>

          <div className="table-wrap">
            <table className="catalog-table">
              <thead>
                <tr>
                  <th>项目</th>
                  <th>负责人</th>
                  <th>类型</th>
                  <th>标签</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {projects?.items.length ? (
                  projects.items.map((project) => (
                    <tr
                      key={project.id}
                      className={selected?.slug === project.slug ? 'active' : ''}
                    >
                      <td>
                        <button
                          type="button"
                          className="catalog-project-button"
                          onClick={() => void selectProject(project.slug)}
                        >
                          <strong>{project.name}</strong>
                          <small>{project.slug}</small>
                        </button>
                      </td>
                      <td>
                        <strong>{project.ownerName}</strong>
                        <small>{project.ownerEmail ?? '-'}</small>
                      </td>
                      <td>{project.type}</td>
                      <td>
                        <span className="tag-line">
                          {project.tags.length > 0 ? project.tags.slice(0, 3).join(', ') : '-'}
                        </span>
                      </td>
                      <td>
                        <span className={`status-pill status-${project.status.toLowerCase()}`}>
                          {project.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5}>
                      <div className="empty-state compact-empty">暂无项目</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <ProjectDetailPanel
          detail={selected}
          members={members}
          credentials={credentials}
          observabilityLinks={observabilityLinks}
          governanceDashboard={governanceDashboard}
          newCredential={newCredential}
          memberEmail={memberEmail}
          memberName={memberName}
          memberRole={memberRole}
          credentialName={credentialName}
          credentialServiceId={credentialServiceId}
          credentialEnvironmentSlug={credentialEnvironmentSlug}
          observabilityTitle={observabilityTitle}
          observabilityUrl={observabilityUrl}
          observabilitySignal={observabilitySignal}
          governanceKind={governanceKind}
          governanceName={governanceName}
          governanceStatus={governanceStatus}
          onCheckEndpoint={onCheckEndpoint}
          onUpsertMember={onUpsertMember}
          onCreateCredential={onCreateCredential}
          onRotateCredential={onRotateCredential}
          onRevokeCredential={onRevokeCredential}
          onCreateObservabilityLink={onCreateObservabilityLink}
          onCreateGovernanceRecord={onCreateGovernanceRecord}
          setMemberEmail={setMemberEmail}
          setMemberName={setMemberName}
          setMemberRole={setMemberRole}
          setCredentialName={setCredentialName}
          setCredentialServiceId={setCredentialServiceId}
          setCredentialEnvironmentSlug={setCredentialEnvironmentSlug}
          setObservabilityTitle={setObservabilityTitle}
          setObservabilityUrl={setObservabilityUrl}
          setObservabilitySignal={setObservabilitySignal}
          setGovernanceKind={setGovernanceKind}
          setGovernanceName={setGovernanceName}
          setGovernanceStatus={setGovernanceStatus}
        />
      </div>

      <div id="integration" className="operations-grid">
        <section className="panel action-panel" aria-label="创建项目">
          <header className="panel-header">
            <h2>新建项目</h2>
            <p className="panel-desc">用于少量手工接入，推荐常规项目使用 manifest。</p>
          </header>
          <form className="form-grid" onSubmit={(event) => void onCreateProject(event)}>
            <label>
              Slug
              <input
                required
                value={form.slug}
                onChange={(event) => setForm({ ...form, slug: event.currentTarget.value })}
                placeholder="order-service"
              />
            </label>
            <label>
              名称
              <input
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.currentTarget.value })}
                placeholder="订单服务"
              />
            </label>
            <label>
              类型
              <select
                value={form.type}
                onChange={(event) =>
                  setForm({ ...form, type: event.currentTarget.value as ProjectType })
                }
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
                placeholder="Alice"
              />
            </label>
            <label>
              邮箱
              <input
                type="email"
                value={form.ownerEmail}
                onChange={(event) => setForm({ ...form, ownerEmail: event.currentTarget.value })}
                placeholder="alice@example.com"
              />
            </label>
            <label>
              仓库
              <input
                value={form.repositoryUrl}
                onChange={(event) => setForm({ ...form, repositoryUrl: event.currentTarget.value })}
                placeholder="git@github.com:example/order-service.git"
              />
            </label>
            <label>
              文档
              <input
                value={form.documentationUrl}
                onChange={(event) =>
                  setForm({ ...form, documentationUrl: event.currentTarget.value })
                }
                placeholder="https://docs.example/order-service"
              />
            </label>
            <label>
              标签
              <input
                value={form.tags}
                onChange={(event) => setForm({ ...form, tags: event.currentTarget.value })}
                placeholder="domain:trade,tier:1"
              />
            </label>
            <button type="submit" className="primary-btn">
              <Plus aria-hidden="true" />
              创建
            </button>
          </form>
        </section>

        <section className="panel action-panel" aria-label="Manifest 接入">
          <header className="panel-header">
            <h2>Manifest 接入</h2>
            <p className="panel-desc">通过 project.yaml 支持 TS、Python 与未来其他语言项目。</p>
          </header>
          <textarea
            className="manifest-editor"
            value={manifest}
            onChange={(event) => setManifest(event.currentTarget.value)}
            spellCheck={false}
            aria-label="Manifest YAML"
          />
          <div className="action-row">
            <button
              type="button"
              className="secondary-btn"
              onClick={() => void onValidateManifest()}
            >
              <FileCode2 aria-hidden="true" />
              校验
            </button>
            <button type="button" className="primary-btn" onClick={() => void onApplyManifest()}>
              <UploadCloud aria-hidden="true" />
              应用
            </button>
          </div>
          <ManifestResult validation={manifestResult} applied={applyResult} />
        </section>
      </div>
    </section>
  );
}

function MetricCard({
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
    <article className="metric-card">
      <span className="metric-icon">{icon}</span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function ProjectDetailPanel({
  detail,
  members,
  credentials,
  observabilityLinks,
  governanceDashboard,
  newCredential,
  memberEmail,
  memberName,
  memberRole,
  credentialName,
  credentialServiceId,
  credentialEnvironmentSlug,
  observabilityTitle,
  observabilityUrl,
  observabilitySignal,
  governanceKind,
  governanceName,
  governanceStatus,
  onCheckEndpoint,
  onUpsertMember,
  onCreateCredential,
  onRotateCredential,
  onRevokeCredential,
  onCreateObservabilityLink,
  onCreateGovernanceRecord,
  setMemberEmail,
  setMemberName,
  setMemberRole,
  setCredentialName,
  setCredentialServiceId,
  setCredentialEnvironmentSlug,
  setObservabilityTitle,
  setObservabilityUrl,
  setObservabilitySignal,
  setGovernanceKind,
  setGovernanceName,
  setGovernanceStatus,
}: {
  detail: ProjectDetailDTO | null;
  members: ProjectMemberDTO[];
  credentials: ServiceCredentialDTO[];
  observabilityLinks: ObservabilityLinkDTO[];
  governanceDashboard: GovernanceDashboardDTO | null;
  newCredential: ServiceCredentialWithTokenDTO | null;
  memberEmail: string;
  memberName: string;
  memberRole: ProjectRole;
  credentialName: string;
  credentialServiceId: string;
  credentialEnvironmentSlug: string;
  observabilityTitle: string;
  observabilityUrl: string;
  observabilitySignal: ObservabilitySignal;
  governanceKind: GovernanceRecordKind;
  governanceName: string;
  governanceStatus: string;
  onCheckEndpoint: (endpointId: string) => Promise<void>;
  onUpsertMember: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onCreateCredential: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onRotateCredential: (credentialId: string) => Promise<void>;
  onRevokeCredential: (credentialId: string) => Promise<void>;
  onCreateObservabilityLink: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onCreateGovernanceRecord: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  setMemberEmail: (value: string) => void;
  setMemberName: (value: string) => void;
  setMemberRole: (value: ProjectRole) => void;
  setCredentialName: (value: string) => void;
  setCredentialServiceId: (value: string) => void;
  setCredentialEnvironmentSlug: (value: string) => void;
  setObservabilityTitle: (value: string) => void;
  setObservabilityUrl: (value: string) => void;
  setObservabilitySignal: (value: ObservabilitySignal) => void;
  setGovernanceKind: (value: GovernanceRecordKind) => void;
  setGovernanceName: (value: string) => void;
  setGovernanceStatus: (value: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');

  if (!detail) {
    return (
      <section className="panel detail-panel" aria-label="项目详情">
        <div className="empty-state">选择一个项目查看治理详情</div>
      </section>
    );
  }

  const governance = governanceDashboard ?? emptyGovernanceDashboard();
  const tasksAndEvaluations = [...governance.tasks, ...governance.promptEvaluations];
  const downEndpoints = detail.endpoints.filter(
    (endpoint) => endpoint.lastHealthStatus === 'UNHEALTHY',
  );
  const healthyEndpoints = detail.endpoints.filter(
    (endpoint) => endpoint.lastHealthStatus === 'HEALTHY',
  );
  const qualityScore = Math.max(
    0,
    100 - governance.summary.activeAlerts * 10 - downEndpoints.length * 20,
  );
  const tabs: Array<{ id: DetailTab; label: string; icon: ReactNode }> = [
    { id: 'overview', label: '概览', icon: <LineChart aria-hidden="true" /> },
    { id: 'services', label: '服务与环境', icon: <Server aria-hidden="true" /> },
    { id: 'governance', label: '治理', icon: <Bell aria-hidden="true" /> },
    { id: 'security', label: '权限凭证', icon: <Users aria-hidden="true" /> },
    { id: 'integration', label: '接入', icon: <FileCode2 aria-hidden="true" /> },
  ];

  return (
    <section className="panel detail-panel" aria-label="项目详情">
      <header className="detail-header portal-detail-header">
        <div>
          <h2>{detail.name}</h2>
          <p>
            {detail.slug} · {detail.type}
          </p>
        </div>
        <span className={`status-pill status-${detail.status.toLowerCase()}`}>{detail.status}</span>
      </header>

      <dl className="facts detail-summary-facts">
        <div>
          <dt>负责人</dt>
          <dd>
            {detail.ownerEmail ? `${detail.ownerName} · ${detail.ownerEmail}` : detail.ownerName}
          </dd>
        </div>
        <div>
          <dt>类型</dt>
          <dd>{detail.type}</dd>
        </div>
        <div>
          <dt>质量分</dt>
          <dd>{qualityScore}</dd>
        </div>
        <div>
          <dt>端点健康</dt>
          <dd>
            {healthyEndpoints.length}/{detail.endpoints.length}
          </dd>
        </div>
        <div>
          <dt>仓库</dt>
          <dd>{detail.repositoryUrl ?? '-'}</dd>
        </div>
        <div>
          <dt>标签</dt>
          <dd>{detail.tags.length > 0 ? detail.tags.join(', ') : '-'}</dd>
        </div>
      </dl>

      <nav className="detail-tabs" aria-label="项目详情视图">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? 'active' : ''}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'overview' ? (
        <div className="tab-panel">
          <div className="detail-columns">
            <section aria-label="治理摘要">
              <h3>治理摘要</h3>
              <dl className="facts governance-facts compact-facts">
                <div>
                  <dt>活跃告警</dt>
                  <dd>{governance.summary.activeAlerts}</dd>
                </div>
                <div>
                  <dt>发布记录</dt>
                  <dd>{governance.deployments.length}</dd>
                </div>
                <div>
                  <dt>月成本</dt>
                  <dd>{formatCents(governance.summary.monthlyCostCents)}</dd>
                </div>
                <div>
                  <dt>模型路由</dt>
                  <dd>{governance.summary.activeModelRoutes}</dd>
                </div>
              </dl>
            </section>

            <section aria-label="运行摘要">
              <h3>运行摘要</h3>
              <dl className="facts governance-facts compact-facts">
                <div>
                  <dt>服务</dt>
                  <dd>{detail.services.length}</dd>
                </div>
                <div>
                  <dt>环境</dt>
                  <dd>{detail.environments.length}</dd>
                </div>
                <div>
                  <dt>端点</dt>
                  <dd>{detail.endpoints.length}</dd>
                </div>
                <div>
                  <dt>异常端点</dt>
                  <dd>{downEndpoints.length}</dd>
                </div>
              </dl>
            </section>
          </div>

          <div className="governance-grid">
            <GovernanceBucket title="近期告警" records={governance.alerts} />
            <GovernanceBucket title="最近发布" records={governance.deployments} />
            <GovernanceBucket title="成本记录" records={governance.costRecords} />
            <GovernanceBucket title="模型治理" records={governance.modelRoutes} />
          </div>
        </div>
      ) : null}

      {activeTab === 'services' ? (
        <div className="tab-panel" id="services">
          <div className="detail-columns">
            <section aria-label="服务">
              <h3>服务</h3>
              <ul className="compact-list">
                {detail.services.map((service) => (
                  <li key={service.id}>
                    <strong>{service.name}</strong>
                    <span>{service.slug}</span>
                    <small>{service.type}</small>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-label="环境">
              <h3>环境</h3>
              <ul className="compact-list">
                {detail.environments.map((environment) => (
                  <li key={environment.id}>
                    <strong>{environment.name}</strong>
                    <span>{environment.slug}</span>
                    <small>{environment.status}</small>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section id="health" aria-label="端点">
            <h3>端点</h3>
            <ul className="endpoint-list">
              {detail.endpoints.map((endpoint) => (
                <li key={endpoint.id}>
                  <div>
                    <strong>{endpoint.baseUrl}</strong>
                    <span>{endpoint.healthCheckPath ?? '/'}</span>
                  </div>
                  <StatusBadge status={healthTone(endpoint.lastHealthStatus)} />
                  <button
                    type="button"
                    className="secondary-btn small-btn"
                    disabled={!endpoint.healthCheckEnabled}
                    onClick={() => void onCheckEndpoint(endpoint.id)}
                  >
                    <ClipboardCheck aria-hidden="true" />
                    检测
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}

      {activeTab === 'integration' ? (
        <div className="tab-panel">
          <section className="observability-section" aria-label="可观测性入口">
            <h3>可观测性</h3>
            <ul className="link-list">
              {observabilityLinks.map((link) => (
                <li key={link.id}>
                  <span className="status-pill">{link.signal}</span>
                  <a href={link.url} target="_blank" rel="noreferrer">
                    {link.title}
                  </a>
                  <small>{link.environmentSlug ?? 'all env'}</small>
                </li>
              ))}
            </ul>
            <form
              className="inline-form"
              onSubmit={(event) => void onCreateObservabilityLink(event)}
            >
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
                placeholder="Grafana 项目总览"
                aria-label="可观测性标题"
              />
              <input
                type="url"
                required
                value={observabilityUrl}
                onChange={(event) => setObservabilityUrl(event.currentTarget.value)}
                placeholder="http://localhost:3002/d/..."
                aria-label="可观测性链接"
              />
              <button type="submit" className="secondary-btn small-btn">
                <Plus aria-hidden="true" />
                添加
              </button>
            </form>
          </section>
        </div>
      ) : null}

      {activeTab === 'governance' ? (
        <div className="tab-panel" id="governance">
          <section className="observability-section" aria-label="治理中枢">
            <h3>治理中枢</h3>
            <dl className="facts governance-facts">
              <div>
                <dt>活跃告警</dt>
                <dd>{governance.summary.activeAlerts}</dd>
              </div>
              <div>
                <dt>发布记录</dt>
                <dd>{governance.deployments.length}</dd>
              </div>
              <div>
                <dt>月成本</dt>
                <dd>{formatCents(governance.summary.monthlyCostCents)}</dd>
              </div>
              <div>
                <dt>模型路由</dt>
                <dd>{governance.summary.activeModelRoutes}</dd>
              </div>
            </dl>

            <div className="governance-grid">
              <GovernanceBucket title="告警" records={governance.alerts} />
              <GovernanceBucket title="发布" records={governance.deployments} />
              <GovernanceBucket title="成本" records={governance.costRecords} />
              <GovernanceBucket
                title="配置/密钥"
                records={[...governance.configurations, ...governance.secretReferences]}
              />
              <GovernanceBucket title="模型" records={governance.modelRoutes} />
              <GovernanceBucket title="任务/评测" records={tasksAndEvaluations} />
            </div>

            <form
              className="inline-form"
              onSubmit={(event) => void onCreateGovernanceRecord(event)}
            >
              <select
                value={governanceKind}
                onChange={(event) =>
                  setGovernanceKind(event.currentTarget.value as GovernanceRecordKind)
                }
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
              <button type="submit" className="secondary-btn small-btn">
                <Plus aria-hidden="true" />
                创建
              </button>
            </form>
          </section>
        </div>
      ) : null}

      {activeTab === 'security' ? (
        <div className="tab-panel" id="access">
          <div className="detail-columns security-columns">
            <section aria-label="成员">
              <h3>成员</h3>
              <ul className="compact-list">
                {members.map((member) => (
                  <li key={member.id}>
                    <strong>{member.user.name}</strong>
                    <span>{member.user.email}</span>
                    <small>{member.role}</small>
                  </li>
                ))}
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
                <button type="submit" className="secondary-btn small-btn">
                  <Users aria-hidden="true" />
                  保存
                </button>
              </form>
            </section>

            <section aria-label="服务凭证">
              <h3>服务凭证</h3>
              {newCredential ? (
                <div className="token-box">
                  <strong>{newCredential.name}</strong>
                  <code>{newCredential.token}</code>
                </div>
              ) : null}
              <ul className="credential-list">
                {credentials.map((credential) => (
                  <li key={credential.id}>
                    <span>
                      <strong>{credential.name}</strong>
                      <small>
                        {credential.environmentSlug} · {credential.status}
                      </small>
                    </span>
                    <button
                      type="button"
                      className="secondary-btn small-btn"
                      onClick={() => void onRotateCredential(credential.id)}
                    >
                      <RefreshCw aria-hidden="true" />
                      轮换
                    </button>
                    <button
                      type="button"
                      className="secondary-btn small-btn"
                      disabled={credential.status === 'REVOKED'}
                      onClick={() => void onRevokeCredential(credential.id)}
                    >
                      吊销
                    </button>
                  </li>
                ))}
              </ul>
              <form className="inline-form" onSubmit={(event) => void onCreateCredential(event)}>
                <select
                  required
                  value={credentialServiceId}
                  onChange={(event) => setCredentialServiceId(event.currentTarget.value)}
                  aria-label="凭证服务"
                >
                  <option value="">选择服务</option>
                  {detail.services.map((service) => (
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
                  {detail.environments.map((environment) => (
                    <option key={environment.id} value={environment.slug}>
                      {environment.name}
                    </option>
                  ))}
                </select>
                <input
                  required
                  value={credentialName}
                  onChange={(event) => setCredentialName(event.currentTarget.value)}
                  placeholder="api-dev"
                  aria-label="凭证名称"
                />
                <button type="submit" className="secondary-btn small-btn">
                  <KeyRound aria-hidden="true" />
                  签发
                </button>
              </form>
            </section>
          </div>
        </div>
      ) : null}
    </section>
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

function GovernanceBucket({ title, records }: { title: string; records: GovernanceRecordDTO[] }) {
  return (
    <section aria-label={title} className="governance-bucket">
      <h4>{title}</h4>
      {records.length > 0 ? (
        <ul className="link-list">
          {records.slice(0, 4).map((record) => (
            <li key={record.id}>
              <span className="status-pill">{record.status}</span>
              <strong>{record.name}</strong>
              <small>{record.environmentSlug ?? record.kind}</small>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-state compact-empty">暂无记录</div>
      )}
    </section>
  );
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

function formatCents(value: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 2,
  }).format(value / 100);
}

function healthTone(status: string): ProbeStatus {
  if (status === 'HEALTHY') return 'ok';
  if (status === 'UNHEALTHY') return 'down';
  return 'loading';
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiClientError) {
    return err.code ? `${err.code}: ${err.message}` : err.message;
  }
  return err instanceof Error ? err.message : '操作失败';
}
