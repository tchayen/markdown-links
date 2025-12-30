import * as vscode from "vscode";
import md5 from "md5";
import { extname } from "path";
import { load as parseYaml } from "js-yaml";
import { MarkdownNode, Graph, WikiLinkNode } from "./types";

/**
 * Clean up malformed URLs by removing common patterns that cause parsing errors.
 * Handles patterns like: ((url)), <(url)>, <[url](url)>
 */
const cleanMalformedUrl = (url: string): string | null => {
  let cleaned: string | null = url;

  // Handle <(url)> pattern - remove angle brackets and outer parenthesis
  if (cleaned.match(/^<\(.+\)>$/)) {
    cleaned = cleaned.slice(2, -2);
  }

  // Handle ((url)) pattern - remove extra parenthesis
  if (cleaned && cleaned.match(/^\(.+\)$/)) {
    cleaned = cleaned.slice(1, -1);
    // If what's left is just a colon or other invalid pattern, return null
    if (cleaned.match(/^:\)?$/)) {
      return null;
    }
  }

  // Handle <[url](url)> pattern - extract the URL from nested markdown
  if (cleaned) {
    const nestedMarkdownMatch = cleaned.match(/^<\[([^\]]+)\]\(([^)]+)\)>$/);
    if (nestedMarkdownMatch) {
      // Use the actual link part (second capture group)
      cleaned = nestedMarkdownMatch[2] || null;
    }
  }

  // Handle <url> pattern - remove angle brackets
  if (cleaned && cleaned.startsWith("<") && cleaned.endsWith(">")) {
    cleaned = cleaned.slice(1, -1);
  }

  return cleaned;
};

export const findLinks = (ast: MarkdownNode): string[] => {
  if (ast.type === "link" || ast.type === "definition") {
    // Ignore empty, anchor and web links.
    let url = "url" in ast ? ast.url : undefined;
    if (!url || url.startsWith("#")) {
      return [];
    }

    // Proactively check for and clean malformed URL patterns
    // These patterns may or may not cause parsing errors, but should be cleaned
    if (
      url.match(/^<\(.+\)>$/) ||
      url.match(/^\(.+\)$/) ||
      url.match(/^<\[.+\]\(.+\)>$/)
    ) {
      const cleaned = cleanMalformedUrl(url);
      if (cleaned) {
        url = cleaned;
      } else {
        return [];
      }
    }

    // Try to parse the URL to check if it's an HTTP link
    try {
      if (vscode.Uri.parse(url).scheme.startsWith("http")) {
        return [];
      }
    } catch {
      // If URL parsing fails, try to clean up malformed URLs
      const cleaned = cleanMalformedUrl(url);
      if (!cleaned) {
        return [];
      }

      // Try parsing the cleaned URL
      try {
        if (vscode.Uri.parse(cleaned).scheme.startsWith("http")) {
          return [];
        }
        // If parsing succeeds and it's not an HTTP link, use the cleaned URL
        url = cleaned;
      } catch {
        // If still fails after cleaning, skip this link
        return [];
      }
    }

    return [url];
  }

  if (ast.type === "wikiLink") {
    const wikiNode = ast as WikiLinkNode;
    return [wikiNode.data?.permalink ?? ""];
  }

  const links: string[] = [];

  if (!("children" in ast) || !ast.children) {
    return links;
  }

  for (const node of ast.children) {
    links.push(...findLinks(node));
  }

  return links;
};

export const findTitle = (ast: MarkdownNode): string | null => {
  if (!("children" in ast) || !ast.children) {
    return null;
  }

  // Prefer to find the title field in frontmatter (YAML)
  for (const child of ast.children) {
    if (child.type === "yaml" && "value" in child && child.value) {
      try {
        const frontmatter = parseYaml(child.value) as Record<string, unknown>;
        if (frontmatter && typeof frontmatter.title === "string") {
          let title = frontmatter.title.trim();
          const titleMaxLength = getTitleMaxLength();
          if (titleMaxLength > 0 && title.length > titleMaxLength) {
            title = title.substring(0, titleMaxLength).concat("...");
          }
          return title;
        }
      } catch {
        // If YAML parsing fails, continue to fallback methods
      }
    }
  }

  // If no frontmatter title, fallback to first-level heading
  for (const child of ast.children) {
    if (
      child.type === "heading" &&
      "depth" in child &&
      child.depth === 1 &&
      "children" in child &&
      child.children &&
      child.children.length > 0
    ) {
      const firstChild = child.children[0];
      let title = "";

      if (firstChild && "value" in firstChild) {
        title = firstChild.value ?? "";
      }

      const titleMaxLength = getTitleMaxLength();
      if (titleMaxLength > 0 && title.length > titleMaxLength) {
        title = title.substring(0, titleMaxLength).concat("...");
      }

      return title;
    }
  }
  return null;
};

export const id = (path: string): string => {
  // Normalize path using VS Code's URI system for cross-platform consistency
  // This ensures the same file gets the same ID on Windows and Unix
  const normalizedPath = vscode.Uri.file(path).fsPath;
  // Extracting file name without extension.
  return md5(
    normalizedPath.substring(
      0,
      normalizedPath.length - extname(normalizedPath).length,
    ),
  );
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

export const getTitleMaxLength = () => {
  return getConfiguration("titleMaxLength");
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
    (edge) => exists(graph, edge.source) && exists(graph, edge.target),
  );
};
