import { getDemoCases as getStoreCases, getDemoCase as getStoreCase, saveDemoCase as saveStoreCase } from "@/lib/storage/case-store";
import type { SlaCase } from "./types";

// Dynamic in-place mutated array for 100% backward compatibility with static imports
export const demoCases: SlaCase[] = [];

export function refreshDemoCases(): void {
  const fresh = getStoreCases();
  demoCases.length = 0;
  demoCases.push(...fresh);
}

// Initial populate
refreshDemoCases();

export function getDemoCase(caseId: string): SlaCase | undefined {
  return getStoreCase(caseId);
}

export function saveDemoCase(slaCase: SlaCase): void {
  saveStoreCase(slaCase);
  refreshDemoCases(); // update the in-place array
}
