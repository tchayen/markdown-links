import * as vscode from "vscode";
import * as md5 from "md5";
import { MarkdownNode, Graph } from "./types";

/**
 * Finds links to other Markdown files in the given file. Handles:
 * - simple local links `[Link](1.md)`.
 * - references `[Reference] <!-- ... --> [reference]: 1.md`.
 * - wiki-style links `[[Link]]`.
 * @param ast abstract syntax tree of a Markdown file.
 */
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

/**
 * Finds title of the given file which is the first heading of depth one
 * (# Like this) encountered. If there is no such thing, returns null.
 * @param ast abstract syntax tree of a Markdown file.
 */
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

/**
 * Translates given path to ID. IDs are unique as long as paths are (which
 * should remain true).
 * @param path absolute path of the file.
 */
export const id = (path: string): string => {
  return md5(path);

  // Extracting file name without extension:
  // const fullPath = path.split("/");
  // const fileName = fullPath[fullPath.length - 1];
  // return fileName.split(".")[0];
};

/**
 * Returns value of configuration for the given key.
 * @param key configuration key. For example in `markdown-links.showColumn`,
 * configuration key is `showColumn`.
 */
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

/**
 * For given configuration key, returns mapping to the vscode.ViewColumn value.
 * @param key configuration key.
 */
export const getColumnSetting = (key: string) => {
  const column = getConfiguration(key);
  return settingToValue[column] || vscode.ViewColumn.One;
};

/**
 * Returns regular expression for finding file IDs in a file.
 */
export const getFileIdRegexp = () => {
  const DEFAULT_VALUE = "\\d{14}";
  const userValue = getConfiguration("fileIdRegexp") || DEFAULT_VALUE;

  // TODO: make `[[` also configurable.
  // Ensure the id is not preceeded by `[[`, which would make it a part of
  // wiki-style link, and put the user-supplied regex in a capturing group to
  // retrieve matching string.
  return new RegExp(`(?<!\\[\\[)(${userValue})`, "m");
};

/**
 * Returns DOT language definition of the given graph.
 * @param graph graph to print.
 */
export const getDot = (graph: Graph) => `digraph g {
${graph.nodes.map((node) => `  ${node.id} [label="${node.label}"];`).join("\n")}
${graph.edges.map((edge) => `  ${edge.source} -> ${edge.target}`).join("\n")}
}`;

/**
 * Returns whether file with given ID is present in the given graph.
 * @param graph graph to check.
 * @param id ID of the file to look for.
 */
export const exists = (graph: Graph, id: string) =>
  !!graph.nodes.find((node) => node.id === id);

/**
 * Filters `edges` array to leave only those that have node in `nodes` for
 * both `source` and `target` of given edge.
 * @param graph object to alter.
 */
export const filterNonExistingEdges = (graph: Graph) => {
  graph.edges = graph.edges.filter(
    (edge) => exists(graph, edge.source) && exists(graph, edge.target)
  );
};
