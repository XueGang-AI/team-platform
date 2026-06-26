import type {
  CreateProjectBody,
  GovernanceRecordDTO,
  GovernanceDashboardDTO,
  GovernanceRecordKind,
  HealthCheckResultDTO,
  LoginResponse,
  ManifestApplyResult,
  ManifestValidationResult,
  PagedResult,
  ProjectDTO,
  ProjectDetailDTO,
  ProjectListQuery,
  ObservabilityLinkDTO,
  ObservabilitySignal,
  ProjectMemberDTO,
  ProjectRole,
  ServiceCredentialDTO,
  ServiceCredentialWithTokenDTO,
} from '@team-platform/contracts';

const API_TIMEOUT_MS = 6000;

export class ApiClientError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function fetchJson<T>(url: string, init?: RequestInit, token?: string | null): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        ...(init?.body ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
    const body = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) {
      const error = extractError(body);
      throw new ApiClientError(error.message, res.status, error.code);
    }
    return body as T;
  } catch (err) {
    if (err instanceof ApiClientError) {
      throw err;
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiClientError(`请求超时（${API_TIMEOUT_MS}ms）`, 0);
    }
    throw new ApiClientError(err instanceof Error ? err.message : '网络请求失败', 0);
  } finally {
    clearTimeout(timeout);
  }
}

export async function login(
  apiBaseUrl: string,
  email: string,
  name: string,
): Promise<LoginResponse> {
  return fetchJson<LoginResponse>(`${apiBaseUrl}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email, name }),
  });
}

function extractError(body: unknown): { message: string; code?: string } {
  if (body && typeof body === 'object' && 'error' in body) {
    const error = (body as { error?: { message?: unknown; code?: unknown } }).error;
    return {
      message: typeof error?.message === 'string' ? error.message : '请求失败',
      code: typeof error?.code === 'string' ? error.code : undefined,
    };
  }
  return { message: '请求失败' };
}

export function buildProjectQuery(query: ProjectListQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '' && value !== null) {
      params.set(key, String(value));
    }
  }
  const search = params.toString();
  return search ? `?${search}` : '';
}

export async function listProjects(
  apiBaseUrl: string,
  query: ProjectListQuery,
  token?: string | null,
): Promise<PagedResult<ProjectDTO>> {
  return fetchJson<PagedResult<ProjectDTO>>(
    `${apiBaseUrl}/projects${buildProjectQuery(query)}`,
    undefined,
    token,
  );
}

export async function getProject(
  apiBaseUrl: string,
  slug: string,
  token?: string | null,
): Promise<ProjectDetailDTO> {
  return fetchJson<ProjectDetailDTO>(
    `${apiBaseUrl}/projects/${encodeURIComponent(slug)}`,
    undefined,
    token,
  );
}

export async function createProject(
  apiBaseUrl: string,
  body: CreateProjectBody,
  token?: string | null,
): Promise<ProjectDTO> {
  return fetchJson<ProjectDTO>(
    `${apiBaseUrl}/projects`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    token,
  );
}

export async function validateManifest(
  apiBaseUrl: string,
  manifest: string,
): Promise<ManifestValidationResult> {
  return fetchJson<ManifestValidationResult>(`${apiBaseUrl}/project-manifests/validate`, {
    method: 'POST',
    body: JSON.stringify({ manifest }),
  });
}

export async function applyManifest(
  apiBaseUrl: string,
  manifest: string,
  token?: string | null,
): Promise<ManifestApplyResult> {
  return fetchJson<ManifestApplyResult>(
    `${apiBaseUrl}/project-manifests/apply`,
    {
      method: 'POST',
      body: JSON.stringify({ manifest }),
    },
    token,
  );
}

export async function checkEndpoint(
  apiBaseUrl: string,
  projectSlug: string,
  endpointId: string,
  token?: string | null,
): Promise<HealthCheckResultDTO> {
  return fetchJson<HealthCheckResultDTO>(
    `${apiBaseUrl}/projects/${encodeURIComponent(projectSlug)}/endpoints/${encodeURIComponent(
      endpointId,
    )}/check`,
    { method: 'POST' },
    token,
  );
}

export async function listMembers(
  apiBaseUrl: string,
  projectSlug: string,
  token?: string | null,
): Promise<ProjectMemberDTO[]> {
  return fetchJson<ProjectMemberDTO[]>(
    `${apiBaseUrl}/projects/${encodeURIComponent(projectSlug)}/members`,
    undefined,
    token,
  );
}

export async function upsertMember(
  apiBaseUrl: string,
  projectSlug: string,
  body: { email: string; name: string; role: ProjectRole },
  token?: string | null,
): Promise<ProjectMemberDTO> {
  return fetchJson<ProjectMemberDTO>(
    `${apiBaseUrl}/projects/${encodeURIComponent(projectSlug)}/members`,
    { method: 'POST', body: JSON.stringify(body) },
    token,
  );
}

export async function listCredentials(
  apiBaseUrl: string,
  projectSlug: string,
  token?: string | null,
): Promise<ServiceCredentialDTO[]> {
  return fetchJson<ServiceCredentialDTO[]>(
    `${apiBaseUrl}/projects/${encodeURIComponent(projectSlug)}/credentials`,
    undefined,
    token,
  );
}

export async function createCredential(
  apiBaseUrl: string,
  projectSlug: string,
  body: { serviceId: string; environmentSlug: string; name: string; expiresAt?: string },
  token?: string | null,
): Promise<ServiceCredentialWithTokenDTO> {
  return fetchJson<ServiceCredentialWithTokenDTO>(
    `${apiBaseUrl}/projects/${encodeURIComponent(projectSlug)}/credentials`,
    { method: 'POST', body: JSON.stringify(body) },
    token,
  );
}

export async function rotateCredential(
  apiBaseUrl: string,
  projectSlug: string,
  credentialId: string,
  token?: string | null,
): Promise<ServiceCredentialWithTokenDTO> {
  return fetchJson<ServiceCredentialWithTokenDTO>(
    `${apiBaseUrl}/projects/${encodeURIComponent(projectSlug)}/credentials/${encodeURIComponent(
      credentialId,
    )}/rotate`,
    { method: 'POST' },
    token,
  );
}

export async function revokeCredential(
  apiBaseUrl: string,
  projectSlug: string,
  credentialId: string,
  token?: string | null,
): Promise<ServiceCredentialDTO> {
  return fetchJson<ServiceCredentialDTO>(
    `${apiBaseUrl}/projects/${encodeURIComponent(projectSlug)}/credentials/${encodeURIComponent(
      credentialId,
    )}/revoke`,
    { method: 'POST' },
    token,
  );
}

export async function listObservabilityLinks(
  apiBaseUrl: string,
  projectSlug: string,
  token?: string | null,
): Promise<ObservabilityLinkDTO[]> {
  return fetchJson<ObservabilityLinkDTO[]>(
    `${apiBaseUrl}/projects/${encodeURIComponent(projectSlug)}/observability-links`,
    undefined,
    token,
  );
}

export async function createObservabilityLink(
  apiBaseUrl: string,
  projectSlug: string,
  body: {
    serviceId?: string;
    environmentSlug?: string;
    signal: ObservabilitySignal;
    title: string;
    url: string;
  },
  token?: string | null,
): Promise<ObservabilityLinkDTO> {
  return fetchJson<ObservabilityLinkDTO>(
    `${apiBaseUrl}/projects/${encodeURIComponent(projectSlug)}/observability-links`,
    { method: 'POST', body: JSON.stringify(body) },
    token,
  );
}

export async function listGovernanceRecords(
  apiBaseUrl: string,
  projectSlug: string,
  token?: string | null,
): Promise<GovernanceRecordDTO[]> {
  return fetchJson<GovernanceRecordDTO[]>(
    `${apiBaseUrl}/projects/${encodeURIComponent(projectSlug)}/governance-records`,
    undefined,
    token,
  );
}

export async function getGovernanceDashboard(
  apiBaseUrl: string,
  projectSlug: string,
  token?: string | null,
): Promise<GovernanceDashboardDTO> {
  return fetchJson<GovernanceDashboardDTO>(
    `${apiBaseUrl}/projects/${encodeURIComponent(projectSlug)}/governance-dashboard`,
    undefined,
    token,
  );
}

export async function createGovernanceRecord(
  apiBaseUrl: string,
  projectSlug: string,
  body: {
    kind: GovernanceRecordKind;
    name: string;
    status: string;
    data?: unknown;
  },
  token?: string | null,
): Promise<GovernanceRecordDTO> {
  return fetchJson<GovernanceRecordDTO>(
    `${apiBaseUrl}/projects/${encodeURIComponent(projectSlug)}/governance-records`,
    { method: 'POST', body: JSON.stringify(body) },
    token,
  );
}
