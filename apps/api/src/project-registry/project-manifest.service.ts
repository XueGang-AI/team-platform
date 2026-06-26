import { Injectable } from '@nestjs/common';
import { load as loadYaml } from 'js-yaml';
import {
  MANIFEST_API_VERSION,
  MANIFEST_KIND,
  ManifestFieldError,
  ProjectManifest,
  ProjectType,
  ServiceType,
  SLUG_REGEX,
} from '@team-platform/contracts';

const projectTypes: readonly ProjectType[] = [
  'WEB_APPLICATION',
  'API_SERVICE',
  'AI_APPLICATION',
  'DATA_SERVICE',
  'INTERNAL_TOOL',
  'OTHER',
];

const serviceTypes: readonly ServiceType[] = [
  'WEB',
  'API',
  'WORKER',
  'SCHEDULER',
  'MODEL_SERVICE',
  'DATA_SERVICE',
  'OTHER',
];

const sensitivePatterns = [
  /\bAKIA[0-9A-Z]{16}\b/i,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/i,
  /\b(api[_-]?key|token|secret|password|passwd|pwd)\b\s*[:=]\s*['"]?[^'"\s]{6,}/i,
  /postgres(?:ql)?:\/\/[^:\s/]+:[^@\s/]+@/i,
  /mysql:\/\/[^:\s/]+:[^@\s/]+@/i,
  /redis:\/\/[^:\s/]+:[^@\s/]+@/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
];

interface ParsedManifestResult {
  apiVersion: string;
  errors: ManifestFieldError[];
  warnings: string[];
  normalized: ProjectManifest | null;
}

@Injectable()
export class ProjectManifestService {
  validate(raw: unknown): ParsedManifestResult {
    const errors: ManifestFieldError[] = [];
    const warnings: string[] = [];
    const parsed = this.parse(raw, errors);

    if (!parsed) {
      return { apiVersion: '', errors, warnings, normalized: null };
    }

    const apiVersion = readString(parsed, 'apiVersion') ?? '';
    if (apiVersion !== MANIFEST_API_VERSION) {
      errors.push({
        path: 'apiVersion',
        message: `仅支持 ${MANIFEST_API_VERSION}`,
      });
    }

    const kind = readString(parsed, 'kind');
    if (kind !== MANIFEST_KIND) {
      errors.push({ path: 'kind', message: `kind 必须为 ${MANIFEST_KIND}` });
    }

    const metadata = readRecord(parsed, 'metadata');
    const spec = readRecord(parsed, 'spec');
    if (!metadata) {
      errors.push({ path: 'metadata', message: 'metadata 必填' });
    }
    if (!spec) {
      errors.push({ path: 'spec', message: 'spec 必填' });
    }

    const slug = metadata ? readString(metadata, 'slug') : undefined;
    const name = metadata ? readString(metadata, 'name') : undefined;
    const description = metadata ? readOptionalString(metadata, 'description') : undefined;
    if (!slug || !SLUG_REGEX.test(slug)) {
      errors.push({ path: 'metadata.slug', message: 'slug 必须为小写 kebab-case' });
    }
    if (!name) {
      errors.push({ path: 'metadata.name', message: 'name 必填' });
    }

    const labels = metadata ? readStringRecord(metadata, 'labels', errors, 'metadata.labels') : {};
    const type = spec ? readString(spec, 'type') : undefined;
    if (!type || !projectTypes.includes(type as ProjectType)) {
      errors.push({ path: 'spec.type', message: '项目类型不合法' });
    }

    const owner = spec ? readRecord(spec, 'owner') : undefined;
    const ownerName = owner ? readString(owner, 'name') : undefined;
    const ownerEmail = owner ? readOptionalString(owner, 'email') : undefined;
    if (!ownerName) {
      errors.push({ path: 'spec.owner.name', message: '项目负责人必填' });
    }

    const repository = spec ? readOptionalRecord(spec, 'repository') : undefined;
    const repositoryUrl = repository ? readOptionalString(repository, 'url') : undefined;
    const documentation = spec ? readOptionalRecord(spec, 'documentation') : undefined;
    const documentationUrl = documentation ? readOptionalString(documentation, 'url') : undefined;

    const services = spec
      ? readArray(spec, 'services', errors, 'spec.services').map((value, index) =>
          this.normalizeService(value, index, errors),
        )
      : [];
    const environments = spec
      ? readArray(spec, 'environments', errors, 'spec.environments').map((value, index) =>
          this.normalizeEnvironment(value, index, errors),
        )
      : [];
    const endpoints = spec
      ? readArray(spec, 'endpoints', errors, 'spec.endpoints').map((value, index) =>
          this.normalizeEndpoint(value, index, errors),
        )
      : [];

    const serviceSlugs = new Set(services.map((service) => service?.slug).filter(Boolean));
    const environmentSlugs = new Set(
      environments.map((environment) => environment?.slug).filter(Boolean),
    );
    this.checkDuplicateSlugs(services, 'spec.services', errors);
    this.checkDuplicateSlugs(environments, 'spec.environments', errors);

    endpoints.forEach((endpoint, index) => {
      if (!endpoint) return;
      if (!serviceSlugs.has(endpoint.service)) {
        errors.push({
          path: `spec.endpoints[${index}].service`,
          message: '端点引用的服务不存在',
        });
      }
      if (!environmentSlugs.has(endpoint.environment)) {
        errors.push({
          path: `spec.endpoints[${index}].environment`,
          message: '端点引用的环境不存在',
        });
      }
    });

    const sensitiveFindings = scanSensitive(parsed);
    for (const finding of sensitiveFindings) {
      errors.push({ path: finding, message: '疑似敏感信息，禁止写入 manifest' });
    }

    if (services.length === 0) {
      warnings.push('未声明 services，项目将只有基础元数据');
    }
    if (environments.length === 0) {
      warnings.push('未声明 environments，项目将没有环境视图');
    }

    const valid =
      errors.length === 0 &&
      slug &&
      name &&
      type &&
      ownerName &&
      metadata &&
      spec &&
      services.every(Boolean) &&
      environments.every(Boolean) &&
      endpoints.every(Boolean);

    if (!valid) {
      return { apiVersion, errors, warnings, normalized: null };
    }

    return {
      apiVersion,
      errors,
      warnings,
      normalized: {
        apiVersion: MANIFEST_API_VERSION,
        kind: MANIFEST_KIND,
        metadata: {
          slug,
          name,
          ...(description ? { description } : {}),
          ...(Object.keys(labels).length > 0 ? { labels } : {}),
        },
        spec: {
          type: type as ProjectType,
          owner: {
            name: ownerName,
            ...(ownerEmail ? { email: ownerEmail } : {}),
          },
          ...(repositoryUrl ? { repository: { url: repositoryUrl } } : {}),
          ...(documentationUrl ? { documentation: { url: documentationUrl } } : {}),
          services: services.filter(isPresent),
          environments: environments.filter(isPresent),
          endpoints: endpoints.filter(isPresent),
        },
      },
    };
  }

  labelsToTags(labels: Record<string, string> | undefined): string[] {
    if (!labels) {
      return [];
    }
    return Object.entries(labels)
      .map(([key, value]) => `${key}:${value}`)
      .sort();
  }

  private parse(raw: unknown, errors: ManifestFieldError[]): Record<string, unknown> | null {
    const value = isManifestEnvelope(raw) ? raw.manifest : raw;
    try {
      const parsed = typeof value === 'string' ? loadYaml(value) : value;
      if (!isRecord(parsed)) {
        errors.push({ path: '$', message: 'manifest 必须是 YAML/JSON 对象' });
        return null;
      }
      return parsed;
    } catch {
      errors.push({ path: '$', message: 'manifest 解析失败' });
      return null;
    }
  }

  private normalizeService(
    value: unknown,
    index: number,
    errors: ManifestFieldError[],
  ): ProjectManifest['spec']['services'][number] | null {
    const path = `spec.services[${index}]`;
    if (!isRecord(value)) {
      errors.push({ path, message: 'service 必须是对象' });
      return null;
    }
    const slug = readString(value, 'slug');
    const name = readString(value, 'name');
    const type = readString(value, 'type');
    const description = readOptionalString(value, 'description');
    if (!slug || !SLUG_REGEX.test(slug)) {
      errors.push({ path: `${path}.slug`, message: '服务 slug 必须为小写 kebab-case' });
    }
    if (!name) {
      errors.push({ path: `${path}.name`, message: '服务名称必填' });
    }
    if (!type || !serviceTypes.includes(type as ServiceType)) {
      errors.push({ path: `${path}.type`, message: '服务类型不合法' });
    }
    if (!slug || !name || !type) {
      return null;
    }
    return {
      slug,
      name,
      type: type as ServiceType,
      ...(description ? { description } : {}),
    };
  }

  private normalizeEnvironment(
    value: unknown,
    index: number,
    errors: ManifestFieldError[],
  ): ProjectManifest['spec']['environments'][number] | null {
    const path = `spec.environments[${index}]`;
    if (!isRecord(value)) {
      errors.push({ path, message: 'environment 必须是对象' });
      return null;
    }
    const slug = readString(value, 'slug');
    const name = readString(value, 'name');
    const description = readOptionalString(value, 'description');
    if (!slug || !SLUG_REGEX.test(slug)) {
      errors.push({ path: `${path}.slug`, message: '环境 slug 必须为小写 kebab-case' });
    }
    if (!name) {
      errors.push({ path: `${path}.name`, message: '环境名称必填' });
    }
    if (!slug || !name) {
      return null;
    }
    return {
      slug,
      name,
      ...(description ? { description } : {}),
    };
  }

  private normalizeEndpoint(
    value: unknown,
    index: number,
    errors: ManifestFieldError[],
  ): ProjectManifest['spec']['endpoints'][number] | null {
    const path = `spec.endpoints[${index}]`;
    if (!isRecord(value)) {
      errors.push({ path, message: 'endpoint 必须是对象' });
      return null;
    }
    const service = readString(value, 'service');
    const environment = readString(value, 'environment');
    const baseUrl = readString(value, 'baseUrl');
    const healthCheck = readOptionalRecord(value, 'healthCheck');
    if (!service) {
      errors.push({ path: `${path}.service`, message: '端点服务引用必填' });
    }
    if (!environment) {
      errors.push({ path: `${path}.environment`, message: '端点环境引用必填' });
    }
    if (!baseUrl || !isValidUrl(baseUrl)) {
      errors.push({ path: `${path}.baseUrl`, message: 'baseUrl 必须是合法 URL' });
    }
    const enabled = healthCheck ? readBoolean(healthCheck, 'enabled') : undefined;
    const healthPath = healthCheck ? readOptionalString(healthCheck, 'path') : undefined;
    if (healthCheck && enabled === undefined) {
      errors.push({ path: `${path}.healthCheck.enabled`, message: 'enabled 必须是布尔值' });
    }
    if (!service || !environment || !baseUrl) {
      return null;
    }
    return {
      service,
      environment,
      baseUrl,
      ...(healthCheck
        ? {
            healthCheck: {
              enabled: enabled ?? false,
              ...(healthPath ? { path: healthPath } : {}),
            },
          }
        : {}),
    };
  }

  private checkDuplicateSlugs(
    items: Array<{ slug: string } | null>,
    path: string,
    errors: ManifestFieldError[],
  ): void {
    const seen = new Set<string>();
    items.forEach((item, index) => {
      if (!item) return;
      if (seen.has(item.slug)) {
        errors.push({ path: `${path}[${index}].slug`, message: 'slug 重复' });
      }
      seen.add(item.slug);
    });
  }
}

function isManifestEnvelope(value: unknown): value is { manifest: unknown } {
  return isRecord(value) && 'manifest' in value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}

function readRecord(value: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const candidate = value[key];
  return isRecord(candidate) ? candidate : null;
}

function readOptionalRecord(
  value: Record<string, unknown>,
  key: string,
): Record<string, unknown> | undefined {
  const candidate = value[key];
  return candidate === undefined ? undefined : (readRecord(value, key) ?? undefined);
}

function readString(value: Record<string, unknown>, key: string): string | undefined {
  const candidate = value[key];
  if (typeof candidate !== 'string') {
    return undefined;
  }
  const trimmed = candidate.trim();
  return trimmed ? trimmed : undefined;
}

function readOptionalString(value: Record<string, unknown>, key: string): string | undefined {
  const candidate = value[key];
  if (candidate === undefined || candidate === null) {
    return undefined;
  }
  return readString(value, key);
}

function readBoolean(value: Record<string, unknown>, key: string): boolean | undefined {
  const candidate = value[key];
  return typeof candidate === 'boolean' ? candidate : undefined;
}

function readArray(
  value: Record<string, unknown>,
  key: string,
  errors: ManifestFieldError[],
  path: string,
): unknown[] {
  const candidate = value[key];
  if (candidate === undefined) {
    return [];
  }
  if (!Array.isArray(candidate)) {
    errors.push({ path, message: '必须是数组' });
    return [];
  }
  return candidate;
}

function readStringRecord(
  value: Record<string, unknown>,
  key: string,
  errors: ManifestFieldError[],
  path: string,
): Record<string, string> {
  const candidate = value[key];
  if (candidate === undefined) {
    return {};
  }
  if (!isRecord(candidate)) {
    errors.push({ path, message: '必须是 key/value 对象' });
    return {};
  }
  const result: Record<string, string> = {};
  for (const [entryKey, entryValue] of Object.entries(candidate)) {
    if (typeof entryValue !== 'string' || !entryValue.trim()) {
      errors.push({ path: `${path}.${entryKey}`, message: 'label 值必须是非空字符串' });
      continue;
    }
    result[entryKey] = entryValue.trim();
  }
  return result;
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function scanSensitive(value: unknown, path = '$'): string[] {
  const findings: string[] = [];
  if (typeof value === 'string') {
    if (sensitivePatterns.some((pattern) => pattern.test(value))) {
      findings.push(path);
    }
    return findings;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => findings.push(...scanSensitive(item, `${path}[${index}]`)));
    return findings;
  }
  if (isRecord(value)) {
    for (const [key, entry] of Object.entries(value)) {
      findings.push(...scanSensitive(entry, `${path}.${key}`));
    }
  }
  return findings;
}
