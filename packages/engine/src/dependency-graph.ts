/**
 * Dependency Graph - Manages node dependencies and execution order
 */

import type { Flow, Node } from '@uwg/schema';

export class DependencyGraph {
  private nodes: Map<string, Node>;
  private adjacencyList: Map<string, Set<string>>;
  private reverseAdjacencyList: Map<string, Set<string>>;

  constructor(private flow: Flow) {
    this.nodes = new Map();
    this.adjacencyList = new Map();
    this.reverseAdjacencyList = new Map();

    this.buildGraph();
  }

  private buildGraph(): void {
    // Initialize nodes
    this.flow.graph.nodes.forEach(node => {
      this.nodes.set(node.id, node);
      this.adjacencyList.set(node.id, new Set());
      this.reverseAdjacencyList.set(node.id, new Set());
    });

    // Build edges from connections
    this.flow.graph.connections.forEach(conn => {
      this.adjacencyList.get(conn.from)?.add(conn.to);
      this.reverseAdjacencyList.get(conn.to)?.add(conn.from);
    });

    // Add edges from node inputs
    this.flow.graph.nodes.forEach(node => {
      node.inputs.forEach(input => {
        this.adjacencyList.get(input.from)?.add(node.id);
        this.reverseAdjacencyList.get(node.id)?.add(input.from);
      });
    });
  }

  /**
   * Get nodes that are ready to execute (all dependencies satisfied)
   */
  getReadyNodes(completedOutputs: Record<string, any>): Node[] {
    const completed = new Set(Object.keys(completedOutputs));
    const ready: Node[] = [];

    this.nodes.forEach((node, nodeId) => {
      // Skip if already completed
      if (completed.has(nodeId)) {
        return;
      }

      // Get all dependencies
      const dependencies = this.reverseAdjacencyList.get(nodeId) || new Set();

      // Check if all dependencies are satisfied
      const allDependenciesMet = Array.from(dependencies).every(dep =>
        completed.has(dep)
      );

      if (allDependenciesMet) {
        ready.push(node);
      }
    });

    return ready;
  }

  /**
   * Get all downstream nodes (nodes that depend on this node)
   */
  getDownstreamNodes(nodeId: string): Node[] {
    const downstream: Node[] = [];
    const visited = new Set<string>();

    const traverse = (id: string) => {
      const neighbors = this.adjacencyList.get(id);
      if (!neighbors) return;

      neighbors.forEach(neighborId => {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          const node = this.nodes.get(neighborId);
          if (node) {
            downstream.push(node);
          }
          traverse(neighborId);
        }
      });
    };

    traverse(nodeId);
    return downstream;
  }

  /**
   * Get direct dependencies of a node
   */
  getDependencies(nodeId: string): string[] {
    return Array.from(this.reverseAdjacencyList.get(nodeId) || []);
  }

  /**
   * Topological sort of nodes
   */
  topologicalSort(): Node[] {
    const sorted: Node[] = [];
    const visited = new Set<string>();
    const temp = new Set<string>();

    const visit = (nodeId: string): void => {
      if (temp.has(nodeId)) {
        throw new Error(`Cycle detected at node: ${nodeId}`);
      }

      if (!visited.has(nodeId)) {
        temp.add(nodeId);

        const dependencies = this.reverseAdjacencyList.get(nodeId);
        if (dependencies) {
          dependencies.forEach(dep => visit(dep));
        }

        temp.delete(nodeId);
        visited.add(nodeId);

        const node = this.nodes.get(nodeId);
        if (node) {
          sorted.push(node);
        }
      }
    };

    this.nodes.forEach((_, nodeId) => {
      if (!visited.has(nodeId)) {
        visit(nodeId);
      }
    });

    return sorted;
  }
}
