export type NodeKind = "service" | "rds" | "sqs";
export type Severity = "high" | "medium" | "low";

export interface Vulnerability {
  file: string;
  severity: Severity;
  message: string;
  metadata: Record<string, string>;
}

export interface GraphNode {
  name: string;
  kind: NodeKind;
  language?: string;
  path?: string;
  publicExposed?: boolean;
  vulnerabilities?: Vulnerability[];
  metadata?: Record<string, unknown>;
}

export interface Edge {
  from: string;
  to: string;
}

export interface RouteMeta {
  startsFromPublic: boolean;
  endsAtSink: boolean;
  hasVulnerability: boolean;
  maxSeverity: Severity | null;
  length: number;
}

export interface Route {
  nodes: GraphNode[];
  edges: Edge[];
  meta: RouteMeta;
}

export interface Graph {
  nodeMap: Map<string, GraphNode>;
  adjacencyList: Map<string, string[]>;
}

export const SINK_KINDS: ReadonlySet<NodeKind> = new Set<NodeKind>(["rds", "sqs"]);

export const SEVERITY_RANK: Record<Severity, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

export function maxSeverity(
  a: Severity | null,
  b: Severity | null
): Severity | null {
  if (a === null) return b;
  if (b === null) return a;
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}
