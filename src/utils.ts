import * as vscode from "vscode";
import * as md5 from "md5";
import { MarkdownNode, Graph } from "./types";

export const findLinks = (ast: MarkdownNode): string[] => {
  if (ast.type === "link" || ast.type === "definition") {
    return [ast.url!];
  }
  if (ast.type === "wikiLink") {
    return [ast.data!.permalink!];
  }

  const links: string[] = [];

  if (!ast.children) {
    return links;
  }

  for (const node of ast.children) {
    links.push(...findLinks(node));
  }

  return links;
};

export const findTitle = (ast: MarkdownNode): string | null => {
  if (!ast.children) {
    return null;
  }

  for (const child of ast.children) {
    if (
      child.type === "heading" &&
      child.depth === 1 &&
      child.children &&
      child.children.length > 0
    ) {
      return child.children[0].value!;
    }
  }
  return null;
};

export const id = (path: string): string => {
  return md5(path);

  // Extracting file name without extension:
  // const fullPath = path.split("/");
  // const fileName = fullPath[fullPath.length - 1];
  // return fileName.split(".")[0];
};

export const getConfiguration = (key: string) =>
  vscode.workspace.getConfiguration("markdown-links")[key];

const settingToValue: { [key: string]: vscode.ViewColumn | undefined } = {
  active: -1,
  beside: -2,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
};

export const getColumnSetting = (key: string) => {
  const column = getConfiguration(key);
  return settingToValue[column] || vscode.ViewColumn.One;
};

export const getFileIdRegexp = () => {
  const DEFAULT_VALUE = "\\d{14}";
  const userValue = getConfiguration("fileIdRegexp") || DEFAULT_VALUE;

  // Ensure the id is not preceeded by [[, which would make it a part of
  // wiki-style link, and put the user-supplied regex in a capturing group to
  // retrieve matching string.
  return new RegExp(`(?<!\\[\\[)(${userValue})`, "m");
};

export const FILE_ID_REGEXP = getFileIdRegexp();

export const getFileTypesSetting = () => {
  const DEFAULT_VALUE = ["md"];
  return getConfiguration("fileTypes") || DEFAULT_VALUE;
};

export const getDot = (graph: Graph) => `digraph g {
  ${graph.nodes
    .map((node) => `  ${node.id} [label="${node.label}"];`)
    .join("\n")}
  ${graph.edges.map((edge) => `  ${edge.source} -> ${edge.target}`).join("\n")}
  }`;

export const exists = (graph: Graph, id: string) =>
  !!graph.nodes.find((node) => node.id === id);

export const filterNonExistingEdges = (graph: Graph) => {
  graph.edges = graph.edges.filter(
    (edge) => exists(graph, edge.source) && exists(graph, edge.target)
  );
};
