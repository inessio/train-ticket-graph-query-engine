import type { GraphNode } from "../../src/core/graph/types";

// Hand-crafted 5-node graph:
//   frontend (public) -> api -> db (rds, sink)
//                     \-> worker (has vuln) -> queue (sqs, sink)
// String-form edge "api" -> "worker" to exercise the legacy edge shape.

export const fixtureNodes: GraphNode[] = [
  { name: "frontend", kind: "service", publicExposed: true, language: "ts" },
  { name: "api", kind: "service", publicExposed: false, language: "ts" },
  {
    name: "worker",
    kind: "service",
    publicExposed: false,
    language: "ts",
    vulnerabilities: [
      {
        file: "worker/src/sql.ts",
        severity: "medium",
        message: "SQL injection risk",
        metadata: { cwe: "CWE-89" },
      },
    ],
  },
  { name: "db", kind: "rds", metadata: { engine: "postgres" } },
  { name: "queue", kind: "sqs", metadata: { cloud: "AWS" } },
];

// "to" appears in both array and string form for builder coverage.
export const fixtureEdges = [
  { from: "frontend", to: ["api"] },
  { from: "api", to: "worker" },
  { from: "api", to: ["db"] },
  { from: "worker", to: ["queue"] },
];
