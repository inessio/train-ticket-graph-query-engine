import type { Edge, GraphNode } from "../../core/graph/types";
import type { FilterOperator } from "../../core/filters/FilterRegistry";

export interface GraphResponseDto {
  nodes: GraphNode[];
  edges: Edge[];
}

export interface GraphRoutesResponseDto extends GraphResponseDto {
  meta: {
    totalRoutes: number;
    appliedFilters: string[];
    operator: FilterOperator;
  };
}

export interface NodeDetailResponseDto {
  node: GraphNode;
  neighbours: GraphNode[];
}

export interface HealthResponseDto {
  status: "ok";
  uptime: number;
  cachedKeys: number;
}

export interface FilterDto {
  name: string;
  description: string;
}

export interface ErrorResponseDto {
  error: string;
  code: string;
  details?: unknown;
}
