import fs from "node:fs";
import path from "node:path";
import type { SlaCase } from "@/lib/domain/types";
import { hashEvidence } from "@/lib/domain/hash";

const DB_DIR = path.join(process.cwd(), ".data");
const DB_PATH = path.join(DB_DIR, "db.json");
const LEGACY_DB_PATH = path.join(process.cwd(), "lib", "storage", "db.json");

const initialDemoCases: SlaCase[] = [
  {
    id: "case-rpc-breach-001",
    title: "Ethereum read endpoint sustained 5xx errors",
    providerName: "Northstar RPC",
    chain: "ethereum-mainnet",
    endpointLabel: "prod-read-primary",
    status: "ready",
    incidentWindow: {
      startUtc: "2026-05-22T10:05:00Z",
      endUtc: "2026-05-22T10:42:00Z",
    },
    incidentSummary:
      "Production reads saw sustained 5xx responses and client failover during the provider incident window.",
    slaTerms: {
      availabilityTarget: "99.9% monthly availability",
      errorThreshold: "5% request failures for 5+ consecutive minutes",
      latencyThreshold: "p95 response latency under 1000ms",
      exclusions: "Planned maintenance, malformed requests, and client-side network errors",
      creditRule: "10% monthly service credit for a confirmed availability breach",
      documentUrl: "https://example.com/northstar-rpc-sla",
    },
    evidence: [
      {
        id: "ev-status-breach",
        type: "status_page",
        title: "Provider status page incident",
        sourceUrl: "https://status.example.com/incidents/northstar-2210",
        submittedExcerpt:
          "Investigating elevated 5xx errors on Ethereum mainnet RPC reads from 10:03 UTC to 10:48 UTC.",
        timeRange: "2026-05-22T10:03:00Z/2026-05-22T10:48:00Z",
        hash: hashEvidence("Investigating elevated 5xx errors on Ethereum mainnet RPC reads from 10:03 UTC to 10:48 UTC."),
      },
      {
        id: "ev-monitor-breach",
        type: "monitoring_summary",
        title: "Internal probe summary",
        submittedExcerpt:
          "Probe group eth-mainnet-primary recorded 18.6% request failures between 10:05 UTC and 10:42 UTC across 11 regions.",
        timeRange: "2026-05-22T10:05:00Z/2026-05-22T10:42:00Z",
        hash: hashEvidence("Probe group eth-mainnet-primary recorded 18.6% request failures between 10:05 UTC and 10:42 UTC across 11 regions."),
      },
      {
        id: "ev-postmortem-breach",
        type: "vendor_postmortem",
        title: "Vendor postmortem",
        sourceUrl: "https://example.com/postmortem/northstar-2210",
        submittedExcerpt:
          "A routing regression caused elevated 5xx responses for Ethereum read calls. Write calls and archive endpoints were less affected.",
        hash: hashEvidence("A routing regression caused elevated 5xx responses for Ethereum read calls. Write calls and archive endpoints were less affected."),
      },
    ],
    createdAt: "2026-05-22T11:15:00Z",
    updatedAt: "2026-05-22T11:18:00Z",
  },
  {
    id: "case-rpc-clean-002",
    title: "Base RPC latency spike below breach threshold",
    providerName: "BeaconNode Cloud",
    chain: "base-mainnet",
    endpointLabel: "checkout-read-path",
    status: "ready",
    incidentWindow: {
      startUtc: "2026-05-22T12:12:00Z",
      endUtc: "2026-05-22T12:16:00Z",
    },
    incidentSummary:
      "Short latency spike with isolated timeout reports, below the provider's five-minute breach threshold.",
    slaTerms: {
      availabilityTarget: "99.95% monthly availability",
      errorThreshold: "10% request failures for 5+ consecutive minutes",
      latencyThreshold: "p95 response latency under 1200ms",
      exclusions: "Client-side retries, malformed JSON-RPC, and regional ISP outages",
      creditRule: "Credit only applies when threshold is exceeded for at least five minutes",
    },
    evidence: [
      {
        id: "ev-status-clean",
        type: "status_page",
        title: "Status page degraded note",
        sourceUrl: "https://status.example.com/incidents/beaconnode-912",
        submittedExcerpt:
          "Brief degraded performance on Base RPC reads from 12:12 UTC to 12:15 UTC. Error rate remained under 3%.",
        timeRange: "2026-05-22T12:12:00Z/2026-05-22T12:15:00Z",
        hash: hashEvidence("Brief degraded performance on Base RPC reads from 12:12 UTC to 12:15 UTC. Error rate remained under 3%."),
      },
      {
        id: "ev-monitor-clean",
        type: "monitoring_summary",
        title: "Probe summary",
        submittedExcerpt:
          "p95 latency peaked at 980ms for three minutes. Request failure rate peaked at 2.7%.",
        hash: hashEvidence("p95 latency peaked at 980ms for three minutes. Request failure rate peaked at 2.7%."),
      },
    ],
    createdAt: "2026-05-22T12:45:00Z",
    updatedAt: "2026-05-22T12:47:00Z",
  },
  {
    id: "case-rpc-inconclusive-003",
    title: "Polygon archive endpoint stale reads",
    providerName: "ArchiveLane",
    chain: "polygon-mainnet",
    endpointLabel: "archive-fallback",
    status: "ready",
    incidentWindow: {
      startUtc: "2026-05-22T08:00:00Z",
      endUtc: "2026-05-22T09:30:00Z",
    },
    incidentSummary:
      "Users reported stale archive reads, but current evidence lacks a provider acknowledgement or consistent probe summary.",
    slaTerms: {
      availabilityTarget: "99.9% monthly availability",
      errorThreshold: "Sustained stale or failed reads above 5% for 10+ minutes",
      latencyThreshold: "p95 response latency under 1500ms",
      exclusions: "Archive backfill operations announced at least 24 hours in advance",
      creditRule: "Service credit requires provider-confirmed stale reads or customer probe logs",
    },
    evidence: [
      {
        id: "ev-community-inconclusive",
        type: "community_report",
        title: "Community report thread",
        sourceUrl: "https://forum.example.com/t/archive-stale-reads",
        submittedExcerpt:
          "Three teams reported stale block responses, but reports use mixed local timezones and no request totals.",
        hash: hashEvidence("Three teams reported stale block responses, but reports use mixed local timezones and no request totals."),
      },
      {
        id: "ev-errors-inconclusive",
        type: "error_sample",
        title: "Sample stale responses",
        submittedExcerpt:
          "Ten example calls returned block data lagging by 35 to 50 blocks. Total request volume is not provided.",
        hash: hashEvidence("Ten example calls returned block data lagging by 35 to 50 blocks. Total request volume is not provided."),
      },
    ],
    createdAt: "2026-05-22T09:55:00Z",
    updatedAt: "2026-05-22T10:10:00Z",
  },
  {
    id: "case-rpc-missing-004",
    title: "Arbitrum read failures need more evidence",
    providerName: "MetroRPC",
    chain: "arbitrum-one",
    endpointLabel: "mobile-app-rpc",
    status: "draft",
    incidentWindow: {
      startUtc: "2026-05-22T14:20:00Z",
      endUtc: "2026-05-22T14:28:00Z",
    },
    incidentSummary:
      "Mobile app team saw intermittent read failures but has not added SLA text or monitoring proof yet.",
    slaTerms: {
      availabilityTarget: "",
      errorThreshold: "",
      latencyThreshold: "",
      exclusions: "",
      creditRule: "",
    },
    evidence: [
      {
        id: "ev-note-missing",
        type: "other",
        title: "Operator note",
        submittedExcerpt:
          "On-call noted user reports around 14:20 UTC but did not attach probe totals or provider status page.",
        hash: hashEvidence("On-call noted user reports around 14:20 UTC but did not attach probe totals or provider status page."),
      },
    ],
    createdAt: "2026-05-22T14:45:00Z",
    updatedAt: "2026-05-22T14:50:00Z",
  },
];

function ensureDbFile() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    if (fs.existsSync(LEGACY_DB_PATH)) {
      fs.copyFileSync(LEGACY_DB_PATH, DB_PATH);
    } else {
      fs.writeFileSync(DB_PATH, JSON.stringify(initialDemoCases, null, 2), "utf-8");
    }
  }
}

function atomicWrite(filePath: string, contents: string): void {
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, contents, "utf-8");
  fs.renameSync(tmpPath, filePath);
}

const lockFile = `${DB_PATH}.lock`;
const LOCK_TIMEOUT_MS = 5_000;
const LOCK_RETRY_MS = 25;

function acquireLock(): void {
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const fd = fs.openSync(lockFile, "wx");
      fs.closeSync(fd);
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw err;
      const stat = fs.statSync(lockFile, { throwIfNoEntry: false });
      if (stat && Date.now() - stat.mtimeMs > LOCK_TIMEOUT_MS * 2) {
        try { fs.unlinkSync(lockFile); } catch { /* race; retry */ }
        continue;
      }
      const wakeup = Date.now() + LOCK_RETRY_MS;
      while (Date.now() < wakeup) { /* tight spin; node has no sync sleep */ }
    }
  }
  throw new Error(`Failed to acquire DB lock at ${lockFile} within ${LOCK_TIMEOUT_MS}ms`);
}

function releaseLock(): void {
  try { fs.unlinkSync(lockFile); } catch { /* already gone */ }
}

export function getDemoCases(): SlaCase[] {
  ensureDbFile();
  const data = fs.readFileSync(DB_PATH, "utf-8");
  try {
    return JSON.parse(data) as SlaCase[];
  } catch (error) {
    throw new Error(
      `Failed to parse SLA cases database at ${DB_PATH}: ${(error as Error).message}`,
    );
  }
}

export function getDemoCase(caseId: string): SlaCase | undefined {
  const cases = getDemoCases();
  return cases.find((c) => c.id === caseId);
}

export function saveDemoCase(slaCase: SlaCase): void {
  ensureDbFile();
  acquireLock();
  try {
    const cases = getDemoCases();
    const index = cases.findIndex((c) => c.id === slaCase.id);
    if (index >= 0) {
      cases[index] = slaCase;
    } else {
      cases.push(slaCase);
    }
    atomicWrite(DB_PATH, JSON.stringify(cases, null, 2));
  } finally {
    releaseLock();
  }
}

// ----- CaseStore interface adapter -----
// Wraps the existing function-style API to satisfy the CaseStore contract
// from case-store-interface.ts. Lets call sites depend on the interface
// instead of the concrete file-backed module.

import type { CaseStore } from "./case-store-interface";

export const fileCaseStore: CaseStore = {
  list: getDemoCases,
  get: getDemoCase,
  save: saveDemoCase,
};
