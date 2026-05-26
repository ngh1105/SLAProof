import type { SlaTerms } from "./types";

export type SlaTemplate = {
  id: string;
  label: string;
  description: string;
  terms: SlaTerms;
};

export const slaTemplates: SlaTemplate[] = [
  {
    id: "custom",
    label: "Custom (start blank)",
    description: "Type your own SLA terms.",
    terms: {
      availabilityTarget: "",
      errorThreshold: "",
      latencyThreshold: "",
      exclusions: "",
      creditRule: "",
    },
  },
  {
    id: "rpc-99-9-monthly",
    label: "Generic 99.9% monthly RPC",
    description: "Typical premium-tier published SLA for shared RPC.",
    terms: {
      availabilityTarget: "99.9% monthly",
      errorThreshold: "5% request failures for 5+ consecutive minutes",
      latencyThreshold: "p95 under 1500ms",
      exclusions: "Planned maintenance announced 24h ahead; force majeure",
      creditRule: "10% credit if monthly availability falls below 99.9%",
    },
  },
  {
    id: "rpc-99-95-monthly",
    label: "Generic 99.95% monthly RPC (enterprise)",
    description: "Typical enterprise-tier published SLA for dedicated RPC.",
    terms: {
      availabilityTarget: "99.95% monthly",
      errorThreshold: "3% request failures for 5+ consecutive minutes",
      latencyThreshold: "p95 under 1000ms",
      exclusions: "Planned maintenance announced 48h ahead; force majeure",
      creditRule: "25% credit if monthly availability falls below 99.95%",
    },
  },
  {
    id: "archive-99-5-monthly",
    label: "Generic 99.5% monthly archive node",
    description: "Typical archive-node tier with relaxed latency.",
    terms: {
      availabilityTarget: "99.5% monthly",
      errorThreshold: "5% request failures for 10+ consecutive minutes",
      latencyThreshold: "p95 under 3000ms",
      exclusions: "Reorg-related re-syncs; planned maintenance",
      creditRule: "10% credit if monthly availability falls below 99.5%",
    },
  },
];

export function findSlaTemplate(id: string): SlaTemplate | undefined {
  return slaTemplates.find((template) => template.id === id);
}
