/**
 * Defines directed edge between two nodes.
 * @param source ID of the starting node of the edge.
 * @param target ID of ending node of the edge.
 */
export type Edge = {
  source: string;
  target: string;
};

/**
 * @param id ID of the node. Should be unique. Used for identifying the nodes
 * and matching them with edges.
 * @param path absolute path of the file. Used for opening files.
 * @param label label used while displaying the node.
 */
export type Node = {
  id: string;
  path: string;
  label: string;
};

/**
 * Graph representation using list of nodes and list of edges.
 */
export type Graph = {
  nodes: Node[];
  edges: Edge[];
};

/**
 * Based on the output of `remark-parse` with `remark-wiki-link` and
 * `remark-frontmatter` plugins.
 * To make it simpler, most fields are made
 * optional.
 * The reason it is used instead of the official type is because it
 * was too general.
 */
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
