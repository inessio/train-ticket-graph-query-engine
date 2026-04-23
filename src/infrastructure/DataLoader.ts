import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";
import { logger } from "../logger/logger";
import type { Edge, GraphNode } from "../core/graph/types";

const VulnerabilitySchema = z.object({
  file: z.string(),
  severity: z.enum(["high", "medium", "low"]),
  message: z.string(),
  metadata: z.record(z.string()),
});

const NodeSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(["service", "rds", "sqs"]),
  language: z.string().optional(),
  path: z.string().optional(),
  publicExposed: z.boolean().optional(),
  vulnerabilities: z.array(VulnerabilitySchema).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const EdgeSchema = z.object({
  from: z.string().min(1),
  to: z.union([z.string().min(1), z.array(z.string().min(1))]),
});

const DataFileSchema = z.object({
  nodes: z.array(NodeSchema),
  edges: z.array(EdgeSchema),
});

export interface LoadedData {
  nodes: GraphNode[];
  edges: Edge[];
}

export async function loadData(filePath: string): Promise<LoadedData> {
  const absolute = path.resolve(filePath);
  logger.info("Loading data file", { path: absolute });

  let raw: string;
  try {
    raw = await fs.readFile(absolute, "utf-8");
  } catch (err) {
    logger.error("Failed to read data file", { path: absolute, err });
    throw err;
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    logger.error("Data file is not valid JSON", { path: absolute, err });
    throw err;
  }

  const parsed = DataFileSchema.safeParse(json);
  if (!parsed.success) {
    logger.error("Data file failed schema validation", {
      issues: parsed.error.flatten(),
    });
    throw new Error("Invalid graph data file");
  }

  const nodes: GraphNode[] = parsed.data.nodes;
  const nodeNames = new Set(nodes.map((n) => n.name));

  const edges: Edge[] = [];
  let droppedForMissingSource = 0;
  let droppedForMissingTarget = 0;

  for (const raw of parsed.data.edges) {
    if (!nodeNames.has(raw.from)) {
      logger.warn("Dropping edge with unknown source node", { edge: raw });
      droppedForMissingSource += 1;
      continue;
    }
    const targets = Array.isArray(raw.to) ? raw.to : [raw.to];
    for (const to of targets) {
      if (!nodeNames.has(to)) {
        logger.warn("Dropping edge with unknown target node", {
          from: raw.from,
          to,
        });
        droppedForMissingTarget += 1;
        continue;
      }
      edges.push({ from: raw.from, to });
    }
  }

  logger.info("Data file loaded", {
    nodes: nodes.length,
    edges: edges.length,
    droppedForMissingSource,
    droppedForMissingTarget,
  });

  return { nodes, edges };
}
