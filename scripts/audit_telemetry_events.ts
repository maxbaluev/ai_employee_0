import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export type Mode = 'check' | 'report';

export interface SourceFile {
  path: string;
  content: string;
}

export interface EventOccurrence {
  file: string;
  snippet: string;
  missingFields: string[];
}

export interface EventInfo {
  name: string;
  stage: string;
  aliases: Set<string>;
}

export interface Catalog {
  events: Map<string, EventInfo>;
  aliasToCanonical: Map<string, string>;
}

export interface AnalysisResult {
  missingEvents: string[];
  orphanEvents: string[];
  occurrences: Map<string, EventOccurrence[]>;
  contextIssues: EventOccurrence[];
  coverage: number;
}

const REQUIRED_FIELDS = ['mission_id', 'tenantId', 'stage', 'persona'];
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py']);
const EXCLUDED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  '.pnpm',
  '.turbo',
  '.cache',
]);

const TELEMETRY_PATTERNS: RegExp[] = [
  /telemetry\.emit\(\s*['"`]([a-z0-9_:-]+)['"`]/gi,
  /_emit_telemetry\(\s*['"`]([a-z0-9_:-]+)['"`]/gi,
  /emitTelemetry\(\s*['"`]([a-z0-9_:-]+)['"`]/gi,
  /trackTelemetry\(\s*['"`]([a-z0-9_:-]+)['"`]/gi,
];

const REQUIRED_FIELD_ALIASES: Record<string, string[]> = {
  mission_id: ['mission_id', 'missionId'],
  tenantId: ['tenantId', 'tenant_id', 'tenantid'],
  stage: ['stage'],
  persona: ['persona'],
};

interface CliOptions {
  mode: Mode;
  output?: string;
  rootDirs: string[];
  docPath: string;
}

function parseArgs(argv: string[]): CliOptions {
  const args = argv.slice(2);
  let mode: Mode | undefined;
  let output: string | undefined;
  const rootDirs: string[] = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--mode') {
      const value = args[i + 1];
      if (value !== 'check' && value !== 'report') {
        throw new Error(`Unsupported mode: ${value}`);
      }
      mode = value;
      i += 1;
      continue;
    }
    if (arg === '--output') {
      output = args[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--root') {
      rootDirs.push(args[i + 1]);
      i += 1;
      continue;
    }
    if (arg === '--doc') {
      const doc = args[i + 1];
      if (!doc) {
        throw new Error('Missing value for --doc');
      }
      return {
        mode: mode ?? 'check',
        output,
        rootDirs: rootDirs.length > 0 ? rootDirs : defaultRoots(),
        docPath: doc,
      };
    }
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return {
    mode: mode ?? 'check',
    output,
    rootDirs: rootDirs.length > 0 ? rootDirs : defaultRoots(),
    docPath: path.join(process.cwd(), 'docs', '06_data_intelligence.md'),
  };
}

function printHelp(): void {
  console.log(
    'Usage: pnpm ts-node --esm scripts/audit_telemetry_events.ts --mode <check|report> [--output <file>]',
  );
  console.log('Options:');
  console.log('  --mode     Run mode: check (default) or report');
  console.log('  --output   Output path for report mode');
  console.log('  --root     Additional root directory to scan (repeatable)');
  console.log('  --doc      Override path to docs/06_data_intelligence.md');
}

function defaultRoots(): string[] {
  return ['src', 'agent', 'scripts', 'supabase'];
}

export function parseEventCatalog(markdown: string): Catalog {
  const events = new Map<string, EventInfo>();
  const aliasToCanonical = new Map<string, string>();

  const lines = markdown.split(/\r?\n/);
  let currentStage: string | null = null;
  let insideTable = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const stageHeadingMatch = line.match(/^###\s+3\.(\d+)\s+([^\n]+)/);
    if (stageHeadingMatch) {
      const section = stageHeadingMatch[1];
      const title = stageHeadingMatch[2].trim();
      if (title.toLowerCase().includes('stage')) {
        currentStage = title.replace('—', '-').trim();
      } else if (section === '8') {
        currentStage = 'Cross-Stage & Platform';
      } else {
        currentStage = title;
      }
      insideTable = false;
      continue;
    }

    if (line.startsWith('|')) {
      const hyphenCandidate = line.replace(/\s|\|/g, '');
      if (hyphenCandidate.length > 0 && /^-+$/.test(hyphenCandidate)) {
        insideTable = true;
        continue;
      }
      if (!insideTable || !currentStage) {
        continue;
      }
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim());
      if (cells.length === 0) {
        continue;
      }
      const eventName = cells[0];
      if (!eventName || eventName.toLowerCase() === 'event') {
        continue;
      }
      const canonicalName = stripBackticks(eventName);
      if (
        !canonicalName ||
        /^stage\s*\d/i.test(canonicalName) ||
        canonicalName.toLowerCase().includes('stage-to-event')
      ) {
        continue;
      }
      if (!events.has(canonicalName)) {
        events.set(canonicalName, {
          name: canonicalName,
          stage: currentStage,
          aliases: new Set<string>(),
        });
      }
      const descriptor = cells.slice(1).join(' ');
      const aliasMatches = descriptor.match(/aliases?\s*\(([^)]+)\)/i);
      if (aliasMatches) {
        aliasMatches[1]
          .split(',')
          .map((alias) => stripBackticks(alias.trim()))
          .filter(Boolean)
          .forEach((alias) => {
            if (alias && !aliasToCanonical.has(alias)) {
              aliasToCanonical.set(alias, canonicalName);
              events.get(canonicalName)?.aliases.add(alias);
            }
          });
      }
      continue;
    }

    const aliasInlineMatch = line.match(/Set `context\.aliases = \['([^']+)'\]` when .*?`([^`]+)`/);
    if (aliasInlineMatch) {
      const alias = aliasInlineMatch[1];
      const canonical = stripBackticks(aliasInlineMatch[2]);
      if (canonical && alias) {
        if (!events.has(canonical)) {
          events.set(canonical, {
            name: canonical,
            stage: currentStage ?? 'Uncategorised',
            aliases: new Set<string>(),
          });
        }
        events.get(canonical)?.aliases.add(alias);
        aliasToCanonical.set(alias, canonical);
      }
    }
  }

  return { events, aliasToCanonical };
}

function stripBackticks(value: string): string {
  return value.replace(/[`*]/g, '').trim();
}

export async function collectSourceFiles(rootDirs: string[]): Promise<SourceFile[]> {
  const files: SourceFile[] = [];
  for (const root of rootDirs) {
    const absoluteRoot = path.isAbsolute(root) ? root : path.join(process.cwd(), root);
    const exists = await pathExists(absoluteRoot);
    if (!exists) {
      continue;
    }
    await walkDirectory(absoluteRoot, files);
  }
  return files;
}

async function walkDirectory(dir: string, files: SourceFile[]): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (EXCLUDED_DIRECTORIES.has(entry.name)) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkDirectory(fullPath, files);
      continue;
    }
    const ext = path.extname(entry.name);
    if (!SCAN_EXTENSIONS.has(ext)) {
      continue;
    }
    const content = await fs.readFile(fullPath, 'utf8');
    files.push({ path: fullPath, content });
  }
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export function analyzeSources(catalog: Catalog, files: SourceFile[]): AnalysisResult {
  const occurrences = new Map<string, EventOccurrence[]>();
  const contextIssues: EventOccurrence[] = [];
  const seenEvents = new Set<string>();
  const orphanEvents = new Set<string>();

  const allCanonicalEvents = new Set(catalog.events.keys());
  const aliasLookup = catalog.aliasToCanonical;

  for (const file of files) {
    const matchedFromPatterns = new Set<string>();
    for (const pattern of TELEMETRY_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(file.content)) !== null) {
        const rawName = match[1];
        matchedFromPatterns.add(rawName);
        const canonical = resolveCanonicalEvent(rawName, catalog);
        if (canonical) {
          seenEvents.add(canonical);
          const snippet = buildSnippet(file.content, match.index);
          const missingFields = analyseContext(snippet);
          const occurrence: EventOccurrence = {
            file: file.path,
            snippet,
            missingFields,
          };
          if (!occurrences.has(canonical)) {
            occurrences.set(canonical, []);
          }
          occurrences.get(canonical)?.push(occurrence);
          if (missingFields.length > 0) {
            contextIssues.push({ ...occurrence, missingFields });
          }
        } else {
          orphanEvents.add(rawName);
        }
      }
    }

    for (const eventName of allCanonicalEvents) {
      if (matchedFromPatterns.has(eventName)) {
        continue;
      }
      if (!file.content.includes(eventName)) {
        continue;
      }
      seenEvents.add(eventName);
      const idx = file.content.indexOf(eventName);
      const snippet = buildSnippet(file.content, idx);
      const missingFields = analyseContext(snippet);
      const occurrence: EventOccurrence = {
        file: file.path,
        snippet,
        missingFields,
      };
      if (!occurrences.has(eventName)) {
        occurrences.set(eventName, []);
      }
      occurrences.get(eventName)?.push(occurrence);
      if (missingFields.length > 0) {
        contextIssues.push({ ...occurrence, missingFields });
      }
    }
  }

  const missingEvents = [...catalog.events.keys()].filter((name) => !seenEvents.has(name));
  const filteredOrphans = [...orphanEvents].filter(
    (name) => !catalog.events.has(name) && !aliasLookup.has(name),
  );

  const coverage =
    catalog.events.size === 0
      ? 1
      : (catalog.events.size - missingEvents.length) / catalog.events.size;

  return {
    missingEvents: missingEvents.sort(),
    orphanEvents: filteredOrphans.sort(),
    occurrences,
    contextIssues,
    coverage,
  };
}

function resolveCanonicalEvent(eventName: string, catalog: Catalog): string | undefined {
  if (catalog.events.has(eventName)) {
    return eventName;
  }
  if (catalog.aliasToCanonical.has(eventName)) {
    return catalog.aliasToCanonical.get(eventName);
  }
  return undefined;
}

function buildSnippet(content: string, index: number, radius = 240): string {
  const start = Math.max(0, index - 80);
  const end = Math.min(content.length, index + radius);
  return content.slice(start, end).replace(/\s+/g, ' ').trim();
}

function analyseContext(snippet: string): string[] {
  const missing: string[] = [];
  for (const field of REQUIRED_FIELDS) {
    const aliases = REQUIRED_FIELD_ALIASES[field] ?? [field];
    const found = aliases.some((alias) => snippet.includes(alias));
    if (!found) {
      missing.push(field);
    }
  }
  return missing;
}

function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

async function generateReport(
  catalog: Catalog,
  analysis: AnalysisResult,
  outputPath: string,
): Promise<void> {
  const lines: string[] = [];
  lines.push('# Telemetry Coverage Report');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`Total documented events: ${catalog.events.size}`);
  lines.push(`Coverage: ${formatPercentage(analysis.coverage)}`);
  lines.push('');
  if (analysis.missingEvents.length > 0) {
    lines.push('## Missing Events');
    lines.push('');
    for (const event of analysis.missingEvents) {
      const stage = catalog.events.get(event)?.stage ?? 'Unknown';
      lines.push(`- **${event}** (stage: ${stage})`);
    }
    lines.push('');
  } else {
    lines.push('## Missing Events');
    lines.push('');
    lines.push('None 🎉');
    lines.push('');
  }

  if (analysis.contextIssues.length > 0) {
    lines.push('## Context Gaps');
    lines.push('');
    for (const issue of analysis.contextIssues) {
      lines.push(`- ${issue.file}: missing [${issue.missingFields.join(', ')}]`);
    }
    lines.push('');
  } else {
    lines.push('## Context Gaps');
    lines.push('');
    lines.push('None');
    lines.push('');
  }

  if (analysis.orphanEvents.length > 0) {
    lines.push('## Orphan Events (not documented)');
    lines.push('');
    for (const orphan of analysis.orphanEvents) {
      lines.push(`- ${orphan}`);
    }
    lines.push('');
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, lines.join('\n'), 'utf8');
}

async function run(): Promise<void> {
  try {
    const options = parseArgs(process.argv);
    const docContent = await fs.readFile(options.docPath, 'utf8');
    const catalog = parseEventCatalog(docContent);
    const files = await collectSourceFiles(options.rootDirs);
    const analysis = analyzeSources(catalog, files);

    if (options.mode === 'report') {
      const output = options.output ?? path.join('docs', 'readiness', 'telemetry_coverage.md');
      await generateReport(catalog, analysis, output);
      console.log(`Report written to ${output}`);
    }

    if (analysis.missingEvents.length > 0) {
      console.error('Missing events:', analysis.missingEvents.join(', '));
    }
    if (analysis.contextIssues.length > 0) {
      console.error('Events with missing context:', analysis.contextIssues.length);
    }
    if (analysis.orphanEvents.length > 0) {
      console.error('Orphan events:', analysis.orphanEvents.join(', '));
    }

    if (
      analysis.missingEvents.length > 0 ||
      analysis.contextIssues.length > 0 ||
      analysis.orphanEvents.length > 0
    ) {
      process.exitCode = 1;
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }
    process.exitCode = 1;
  }
}

const isEntryPoint = (() => {
  const modulePath = pathToFileURL(process.argv[1]).href;
  return import.meta.url === modulePath;
})();

if (isEntryPoint) {
  void run();
}
