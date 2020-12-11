import { StringifyOptions } from "querystring";
import { runInThisContext } from "vm";

export class Node {
  public id: string;
  public path: string;
  public label: string;
  public links: Set<string> = new Set();
  public backlinks: Set<string> = new Set();

  constructor(id: string, path: string, label: string) {
    this.id = id;
    this.path = path;
    this.label = label;
  }

  public addLink(targetNodeId: string): void {
    this.links.add(targetNodeId);
  }

  public addBacklink(srcNodeId: string): void {
    this.backlinks.add(srcNodeId);
  }

  public removeLink(dstNodeId: string): void {
    this.links.delete(dstNodeId);
  }

  public removeBacklink(srcNodeId: string): void {
    this.backlinks.delete(srcNodeId);
  }

  public filterLinks(filterFunc: (dstNodeId: string) => boolean): void {
    this.links = new Set([...this.links.values()].filter(filterFunc));
  }

  public filterBacklinks(filterFunc: (srcNodeId: string) => boolean): void {
    this.backlinks = new Set([...this.backlinks.values()].filter(filterFunc));
  }

  public toD3Node(): D3Node {
    return {
      id: this.id,
      path: this.path,
      label: this.label,
    };
  }

  public toD3Edges(): D3Edge[] {
    const edges: D3Edge[] = [];
    this.links.forEach((dstNodeId) => edges.push({
      source: this.id,
      target: dstNodeId,
    }));
    return edges;
  }
}

export class Graph {
  private nodes: Map<string, Node>;

  constructor() {
    this.nodes = new Map();
  }

  public getNode(id: string): Node | undefined {
    return this.nodes.get(id);
  }

  public getNodeByPath(path: string): Node | undefined {
    for (const node of this.nodes.values()) {
      if (node.path === path) {
        return node;
      }
    }
    return undefined;
  }

  /**
   * Removes a node from the graph, along with any links or backlinks pointing to it.
   * @param id The id of the node to be removed.
   */
  public removeNode(id: string): void {
    this.nodes.get(id)?.links.forEach((dstNodeId) => this.nodes.get(dstNodeId)?.removeBacklink(id));
    this.nodes.get(id)?.backlinks.forEach((srcNodeId) => this.nodes.get(srcNodeId)?.removeLink(id));
    this.nodes.delete(id);
  }

  public updateNodePath(oldPath: string, newPath: string): void {
    const node = this.getNodeByPath(oldPath);
    if (node) {
      node.path = newPath;
    }
  }

  /**
   * Removes any links/backlinks where the linked node does not exist and adds backlinks.
   * You should run this method after adding one or more nodes or edges to the graph.
   */
  public fixEdges(): void {
    this.nodes.forEach((node) => {
      node.filterLinks((dstNodeId) => this.nodes.has(dstNodeId));
      node.filterBacklinks((srcNodeId) => this.nodes.has(srcNodeId));
      node.links.forEach((dstNodeId) => this.nodes.get(dstNodeId)?.addBacklink(node.id));
    });
  }

  /**
   * Adds a node to the graph. If the node includes links or backlinks, the graph may be inconsistent
   * until {@link fixEdges} is called.
   * @param node The node to be added to the graph.
   */
  public addNode(node: Node): void {
    this.nodes.set(node.id, node);
  }

  /**
   * Adds a link from srcNodeId to dstNodeId. It does not automatically add a backlink on the
   * destination node, so the graph will be inconsistent until {@link fixEdges} is called.
   * @param srcNodeId The id of the node that the link originates from
   * @param dstNodeId The id of the node the link goes to.
   */
  public addLink(srcNodeId: string, dstNodeId: string): void {
    this.nodes.get(srcNodeId)?.addLink(dstNodeId);
  }


  /**
   * Removes all links from the specified node, as well as any matching backlinks.
   * @param nodeId the node to remove all links from.
   */
  public clearNodeLinks(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return;
    }
    node.links.forEach((dstNodeId) => this.nodes.get(dstNodeId)?.removeBacklink(nodeId));
    node.links = new Set();
  }

  /**
   * Outputs a javascript object representing the graph that can be rendered in D3.
   */
  public toD3Graph(): D3Graph {
    const graph: D3Graph = {
      nodes: [],
      edges: [],
    };
    this.nodes.forEach((node) => {
      graph.nodes.push(node.toD3Node());
      graph.edges.push(...node.toD3Edges());
    });
    return graph;
  }
}

export type D3Graph = {
  nodes: D3Node[];
  edges: D3Edge[];
};

export type D3Node = {
  id: string;
  path: string;
  label: string;
};

export type D3Edge = {
  source: string;
  target: string;
};

export type MarkdownNode = {
  type: string;
  children?: MarkdownNode[];
  url?: string;
  value?: string;
  depth?: number;
  data?: {
    permalink?: string;
  };
};
