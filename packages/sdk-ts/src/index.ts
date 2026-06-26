import type {
  CreateGovernanceItemBody,
  GovernanceDashboardDTO,
  GovernanceRecordDTO,
  GovernanceRecordKind,
  LoginResponse,
  ManifestApplyResult,
  ManifestValidationResult,
  PagedResult,
  ProjectDTO,
  ProjectListQuery,
} from '@team-platform/contracts';

export interface TeamPlatformClientOptions {
  baseUrl: string;
  token?: string;
  timeoutMs?: number;
}

export class TeamPlatformError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export class TeamPlatformClient {
  private token?: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: TeamPlatformClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.token = options.token;
    this.timeoutMs = options.timeoutMs ?? 5000;
  }

  setToken(token: string): void {
    this.token = token;
  }

  async login(email: string, name: string): Promise<LoginResponse> {
    const result = await this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, name }),
    });
    this.token = result.token;
    return result;
  }

  async listProjects(query: ProjectListQuery = {}): Promise<PagedResult<ProjectDTO>> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, String(value));
      }
    }
    const search = params.toString();
    return this.request<PagedResult<ProjectDTO>>(`/projects${search ? `?${search}` : ''}`);
  }

  async validateManifest(manifest: string): Promise<ManifestValidationResult> {
    return this.request<ManifestValidationResult>('/project-manifests/validate', {
      method: 'POST',
      body: JSON.stringify({ manifest }),
    });
  }

  async applyManifest(manifest: string): Promise<ManifestApplyResult> {
    return this.request<ManifestApplyResult>('/project-manifests/apply', {
      method: 'POST',
      body: JSON.stringify({ manifest }),
    });
  }

  async getGovernanceDashboard(projectSlug: string): Promise<GovernanceDashboardDTO> {
    return this.request<GovernanceDashboardDTO>(
      `/projects/${encodeURIComponent(projectSlug)}/governance-dashboard`,
    );
  }

  async createGovernanceRecord(
    projectSlug: string,
    kind: GovernanceRecordKind,
    body: CreateGovernanceItemBody,
  ): Promise<GovernanceRecordDTO> {
    return this.request<GovernanceRecordDTO>(
      `/projects/${encodeURIComponent(projectSlug)}/governance-records`,
      {
        method: 'POST',
        body: JSON.stringify({ ...body, kind }),
      },
    );
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          accept: 'application/json',
          ...(init?.body ? { 'content-type': 'application/json' } : {}),
          ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
          ...init?.headers,
        },
      });
      const body = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        const error = extractError(body);
        throw new TeamPlatformError(error.message, response.status, error.code);
      }
      return body as T;
    } catch (err) {
      if (err instanceof TeamPlatformError) {
        throw err;
      }
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new TeamPlatformError(`request timeout after ${this.timeoutMs}ms`, 0);
      }
      throw new TeamPlatformError(err instanceof Error ? err.message : 'request failed', 0);
    } finally {
      clearTimeout(timeout);
    }
  }
}

function extractError(body: unknown): { message: string; code?: string } {
  if (body && typeof body === 'object' && 'error' in body) {
    const error = (body as { error?: { message?: unknown; code?: unknown } }).error;
    return {
      message: typeof error?.message === 'string' ? error.message : 'request failed',
      code: typeof error?.code === 'string' ? error.code : undefined,
    };
  }
  return { message: 'request failed' };
}
