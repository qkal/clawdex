export interface MemoryEntry {
  id: string;
  content: string;
  source: string; // session id or "consolidation"
  createdAt: string;
  tags?: string[];
}

export interface ConsolidationResult {
  summary: string;
  entriesProcessed: number;
  timestamp: string;
}
