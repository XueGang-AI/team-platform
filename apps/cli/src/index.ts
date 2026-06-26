#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { TeamPlatformClient, TeamPlatformError } from '@team-platform/sdk-ts';
import type { GovernanceRecordKind } from '@team-platform/contracts';

interface CliOptions {
  api: string;
  token?: string;
  email?: string;
  name?: string;
  project?: string;
  kind?: GovernanceRecordKind;
  status?: string;
  data?: string;
  serviceId?: string;
  environmentSlug?: string;
}

async function main(argv: string[]): Promise<void> {
  const command = argv[0];
  const options = parseOptions(argv.slice(1));
  const client = new TeamPlatformClient({
    baseUrl: options.api,
    token: options.token ?? process.env.TEAM_PLATFORM_TOKEN,
  });

  if (command === 'login') {
    requireOption(options.email, '--email');
    requireOption(options.name, '--name');
    const result = await client.login(options.email, options.name);
    printJson(result);
    return;
  }

  if (command === 'validate') {
    const file = firstPositional(argv.slice(1));
    requireOption(file, '<manifest-file>');
    printJson(await client.validateManifest(await readFile(file, 'utf8')));
    return;
  }

  if (command === 'apply') {
    const file = firstPositional(argv.slice(1));
    requireOption(file, '<manifest-file>');
    printJson(await client.applyManifest(await readFile(file, 'utf8')));
    return;
  }

  if (command === 'projects' && argv[1] === 'list') {
    printJson(await client.listProjects());
    return;
  }

  if (command === 'governance' && argv[1] === 'dashboard') {
    requireOption(options.project, '--project');
    printJson(await client.getGovernanceDashboard(options.project));
    return;
  }

  if (command === 'governance' && argv[1] === 'create') {
    requireOption(options.project, '--project');
    requireOption(options.kind, '--kind');
    requireOption(options.name, '--name');
    requireOption(options.status, '--status');
    printJson(
      await client.createGovernanceRecord(options.project, options.kind, {
        name: options.name,
        status: options.status,
        serviceId: options.serviceId,
        environmentSlug: options.environmentSlug,
        data: options.data ? parseJson(options.data, '--data') : {},
      }),
    );
    return;
  }

  usage();
}

function parseOptions(args: string[]): CliOptions {
  const options: CliOptions = {
    api: process.env.TEAM_PLATFORM_API ?? 'http://localhost:3001',
  };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === '--api' && next) {
      options.api = next;
      i += 1;
    } else if (arg === '--token' && next) {
      options.token = next;
      i += 1;
    } else if (arg === '--email' && next) {
      options.email = next;
      i += 1;
    } else if (arg === '--name' && next) {
      options.name = next;
      i += 1;
    } else if (arg === '--project' && next) {
      options.project = next;
      i += 1;
    } else if (arg === '--kind' && next) {
      options.kind = next as GovernanceRecordKind;
      i += 1;
    } else if (arg === '--status' && next) {
      options.status = next;
      i += 1;
    } else if (arg === '--data' && next) {
      options.data = next;
      i += 1;
    } else if (arg === '--service-id' && next) {
      options.serviceId = next;
      i += 1;
    } else if (arg === '--environment' && next) {
      options.environmentSlug = next;
      i += 1;
    }
  }
  return options;
}

function firstPositional(args: string[]): string | undefined {
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      i += 1;
      continue;
    }
    if (arg !== 'list') {
      return arg;
    }
  }
  return undefined;
}

function requireOption<T>(value: T | undefined, name: string): asserts value is T {
  if (!value) {
    throw new TeamPlatformError(`missing required argument ${name}`, 0);
  }
}

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function parseJson(value: string, name: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new TeamPlatformError(`invalid JSON for ${name}`, 0);
  }
}

function usage(): void {
  process.stdout.write(`team-platform CLI

Commands:
  team-platform login --email <email> --name <name> [--api <url>]
  team-platform validate <project.yaml> [--api <url>]
  team-platform apply <project.yaml> [--api <url>] [--token <token>]
  team-platform projects list [--api <url>] [--token <token>]
  team-platform governance dashboard --project <slug> [--api <url>] [--token <token>]
  team-platform governance create --project <slug> --kind <kind> --name <name> --status <status> [--service-id <id>] [--environment <slug>] [--data <json>] [--api <url>] [--token <token>]

Environment:
  TEAM_PLATFORM_API     API base URL
  TEAM_PLATFORM_TOKEN   Bearer token
`);
}

main(process.argv.slice(2)).catch((err: unknown) => {
  if (err instanceof TeamPlatformError) {
    const code = err.code ? ` ${err.code}` : '';
    process.stderr.write(`error${code}: ${err.message}\n`);
    process.exitCode = err.status === 0 ? 2 : 1;
    return;
  }
  process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
});
