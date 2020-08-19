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

export type TemplateVariables = {
  graphType: string
}