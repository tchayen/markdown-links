export type Edge = {
  source: string;
  target: string;
};

export type Node = {
  id: string;
  path: string;
  label: string;
  links: string[];
  backlinks: string[];
};

export type Graph = {
  nodes: Node[];
  edges: Edge[];
};

export type State = {
  graph: Record<string, Node>;
  currentNode?: string;
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
