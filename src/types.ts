import type { Root, RootContent } from "mdast";

export type Edge = {
  source: string;
  target: string;
};

export type Node = {
  id: string;
  path: string;
  label: string;
};

export type Graph = {
  nodes: Node[];
  edges: Edge[];
};

// Custom type that extends mdast types to support wiki-link plugin
export type MarkdownNode = Root | RootContent | WikiLinkNode;

export type WikiLinkNode = {
  type: "wikiLink";
  value?: string;
  data?: {
    permalink?: string;
  };
  children?: MarkdownNode[];
};
