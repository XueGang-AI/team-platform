import { ProjectManifestService } from '../../src/project-registry/project-manifest.service';

describe('ProjectManifestService', () => {
  const service = new ProjectManifestService();

  it('normalizes a valid YAML manifest', () => {
    const result = service.validate(`
apiVersion: team-platform.io/v1alpha1
kind: Project
metadata:
  slug: team-platform
  name: Team Platform
  labels:
    language: typescript
spec:
  type: INTERNAL_TOOL
  owner:
    name: Platform
  services:
    - slug: api
      name: API
      type: API
  environments:
    - slug: dev
      name: Development
  endpoints:
    - service: api
      environment: dev
      baseUrl: http://localhost:3001
      healthCheck:
        enabled: true
        path: /health/ready
`);

    expect(result.errors).toEqual([]);
    expect(result.normalized?.metadata.slug).toBe('team-platform');
    expect(result.normalized?.spec.services[0]?.slug).toBe('api');
  });

  it('rejects invalid references and suspicious secrets', () => {
    const result = service.validate(`
apiVersion: team-platform.io/v1alpha1
kind: Project
metadata:
  slug: bad-project
  name: Bad Project
spec:
  type: API_SERVICE
  owner:
    name: Alice
  repository:
    url: postgresql://user:password@db.example/prod
  services:
    - slug: api
      name: API
      type: API
  environments:
    - slug: dev
      name: Development
  endpoints:
    - service: missing
      environment: dev
      baseUrl: http://localhost:3001
`);

    expect(result.normalized).toBeNull();
    const messages = result.errors.map((error) => error.message);
    expect(messages).toContain('端点引用的服务不存在');
    expect(messages).toContain('疑似敏感信息，禁止写入 manifest');
  });
});
