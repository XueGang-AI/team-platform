import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Project registry integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.auditEvent.deleteMany();
    await prisma.governanceRecord.deleteMany();
    await prisma.observabilityLink.deleteMany();
    await prisma.serviceCredential.deleteMany();
    await prisma.serviceEndpoint.deleteMany();
    await prisma.projectMember.deleteMany();
    await prisma.service.deleteMany();
    await prisma.environment.deleteMany();
    await prisma.project.deleteMany();
    await prisma.user.deleteMany();

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@example.com', name: 'Admin' })
      .expect(201);
    token = login.body.token;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('creates, lists, updates and archives a project', async () => {
    const created = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        slug: 'order-service',
        name: 'Order Service',
        type: 'API_SERVICE',
        ownerName: 'Alice',
        ownerEmail: 'alice@example.com',
        repositoryUrl: 'git@github.com:example/order-service.git',
        tags: ['domain:trade', 'tier:1'],
      })
      .expect(201);

    expect(created.body.slug).toBe('order-service');

    await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        slug: 'order-service',
        name: 'Duplicate',
        type: 'API_SERVICE',
        ownerName: 'Alice',
      })
      .expect(409);

    const listed = await request(app.getHttpServer())
      .get('/projects')
      .set('Authorization', `Bearer ${token}`)
      .query({ search: 'order', tag: 'tier:1' })
      .expect(200);
    expect(listed.body.total).toBe(1);
    expect(listed.body.items[0].slug).toBe('order-service');

    const updated = await request(app.getHttpServer())
      .patch('/projects/order-service')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'MAINTENANCE', documentationUrl: 'http://docs.local/order-service' })
      .expect(200);
    expect(updated.body.status).toBe('MAINTENANCE');

    const archived = await request(app.getHttpServer())
      .post('/projects/order-service/archive')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(archived.body.status).toBe('ARCHIVED');
    expect(archived.body.archivedAt).toBeTruthy();
  });

  it('manages services, environments and endpoints under a project', async () => {
    await createProject('team-platform');

    const service = await request(app.getHttpServer())
      .post('/projects/team-platform/services')
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: 'api', name: 'Platform API', type: 'API' })
      .expect(201);
    const environment = await request(app.getHttpServer())
      .post('/projects/team-platform/environments')
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: 'dev', name: 'Development' })
      .expect(201);
    const endpoint = await request(app.getHttpServer())
      .post('/projects/team-platform/endpoints')
      .set('Authorization', `Bearer ${token}`)
      .send({
        serviceId: service.body.id,
        environmentId: environment.body.id,
        baseUrl: 'http://example.com',
        healthCheckPath: '/health/ready',
        healthCheckEnabled: true,
      })
      .expect(201);

    const detail = await request(app.getHttpServer())
      .get('/projects/team-platform')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(detail.body.services).toHaveLength(1);
    expect(detail.body.environments).toHaveLength(1);
    expect(detail.body.endpoints).toHaveLength(1);

    await request(app.getHttpServer())
      .post(`/projects/team-platform/endpoints/${endpoint.body.id}/check`)
      .set('Authorization', `Bearer ${token}`)
      .expect(503);

    const stored = await prisma.serviceEndpoint.findUnique({ where: { id: endpoint.body.id } });
    expect(stored?.lastHealthStatus).toBe('UNHEALTHY');
    expect(stored?.lastErrorCode).toBe('HEALTH_CHECK_HOST_NOT_ALLOWED');
  });

  it('exposes dedicated governance APIs for alerts, deployments, cost and model routes', async () => {
    await createProject('manjv-studio');

    await request(app.getHttpServer())
      .post('/projects/manjv-studio/alerts/rules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'API 5xx rate',
        status: 'ACTIVE',
        data: { query: 'rate(http_requests_total{status=~"5.."}[5m]) > 0.05' },
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/projects/manjv-studio/deployments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'deploy web 0.1.0',
        status: 'SUCCESS',
        environmentSlug: 'prod',
        data: { version: '0.1.0', commit: 'local' },
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/projects/manjv-studio/cost-records')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Ark model usage',
        status: 'RECORDED',
        data: { amountCents: 12800, provider: 'ark' },
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/projects/manjv-studio/model-routes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'text-generation',
        status: 'ACTIVE',
        data: { provider: 'ark', fallback: 'mock' },
      })
      .expect(201);

    const dashboard = await request(app.getHttpServer())
      .get('/projects/manjv-studio/governance-dashboard')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(dashboard.body.summary.activeAlerts).toBe(1);
    expect(dashboard.body.summary.openDeployments).toBe(0);
    expect(dashboard.body.summary.monthlyCostCents).toBe(12800);
    expect(dashboard.body.summary.activeModelRoutes).toBe(1);
    expect(dashboard.body.alerts).toHaveLength(1);
    expect(dashboard.body.deployments).toHaveLength(1);
    expect(dashboard.body.costRecords).toHaveLength(1);
    expect(dashboard.body.modelRoutes).toHaveLength(1);
  });

  it('validates and idempotently applies project manifests', async () => {
    const manifest = {
      apiVersion: 'team-platform.io/v1alpha1',
      kind: 'Project',
      metadata: {
        slug: 'python-worker',
        name: 'Python Worker',
        labels: { language: 'python', tier: '2' },
      },
      spec: {
        type: 'DATA_SERVICE',
        owner: { name: 'Bob', email: 'bob@example.com' },
        repository: { url: 'git@github.com:example/python-worker.git' },
        services: [{ slug: 'worker', name: 'Worker', type: 'WORKER' }],
        environments: [{ slug: 'dev', name: 'Development' }],
        endpoints: [
          {
            service: 'worker',
            environment: 'dev',
            baseUrl: 'http://localhost:9000',
            healthCheck: { enabled: true, path: '/healthz' },
          },
        ],
      },
    };

    const validated = await request(app.getHttpServer())
      .post('/project-manifests/validate')
      .send({ manifest })
      .expect(200);
    expect(validated.body.valid).toBe(true);
    expect(validated.body.normalized.metadata.slug).toBe('python-worker');

    const firstApply = await request(app.getHttpServer())
      .post('/project-manifests/apply')
      .set('Authorization', `Bearer ${token}`)
      .send({ manifest })
      .expect(200);
    expect(firstApply.body.summary.created.projects).toBe(1);
    expect(firstApply.body.summary.created.services).toBe(1);

    const secondApply = await request(app.getHttpServer())
      .post('/project-manifests/apply')
      .set('Authorization', `Bearer ${token}`)
      .send({ manifest })
      .expect(200);
    expect(secondApply.body.summary.updated.projects).toBe(1);
    expect(secondApply.body.summary.updated.services).toBe(1);

    const detail = await request(app.getHttpServer())
      .get('/projects/python-worker')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(detail.body.tags).toEqual(['language:python', 'tier:2']);
  });

  it('rejects invalid manifests and suspicious secrets', async () => {
    const invalid = await request(app.getHttpServer())
      .post('/project-manifests/validate')
      .send({
        manifest: `
apiVersion: team-platform.io/v1alpha1
kind: Project
metadata:
  slug: BadSlug
  name: Bad
spec:
  type: API_SERVICE
  owner:
    name: Alice
  repository:
    url: postgresql://user:password@db.example/prod
`,
      })
      .expect(200);

    expect(invalid.body.valid).toBe(false);
    expect(JSON.stringify(invalid.body.errors)).toContain('疑似敏感信息');

    await request(app.getHttpServer())
      .post('/project-manifests/apply')
      .set('Authorization', `Bearer ${token}`)
      .send({ manifest: invalid.body.normalized ?? 'not: [' })
      .expect(400);
  });

  async function createProject(slug: string): Promise<void> {
    await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ slug, name: slug, type: 'INTERNAL_TOOL', ownerName: 'Platform' })
      .expect(201);
  }
});
