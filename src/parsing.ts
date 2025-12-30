import vscode from "vscode";
import path from "path";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkWikiLink from "remark-wiki-link";
import remarkFrontmatter from "remark-frontmatter";
import { Graph } from "./types";
import { TextDecoder } from "util";
import {
  findTitle,
  findLinks,
  id,
  FILE_ID_REGEXP,
  getFileTypesSetting,
  getExcludePatternsSetting,
  getConfiguration,
} from "./utils";
import { basename } from "path";

const idToPath: Record<string, string> = {};

/**
 * Resolve a link to its target path based on the link type and context.
 * This is a pure function that can be tested independently of VS Code APIs.
 *
 * @param link - The link string (e.g., "./file.md", "/docs/file.md", "../parent.md")
 * @param currentFileDir - The directory of the current file
 * @param workspaceRoot - The workspace root directory (optional)
 * @returns The resolved absolute path, or null if resolution fails
 */
export const resolveLinkPath = (
  link: string,
  currentFileDir: string,
  workspaceRoot?: string,
): string | null => {
  if (link.startsWith("/")) {
    // Workspace-relative path
    if (!workspaceRoot) {
      return null;
    }
    // Remove leading slash and join with workspace root
    return path.join(workspaceRoot, link.substring(1));
  } else if (path.isAbsolute(link)) {
    // Absolute filesystem path
    return link;
  } else {
    // Relative path from current file's directory
    return path.join(currentFileDir, link);
  }
};

export const idResolver = (id: string) => {
  const filePath = idToPath[id];
  if (filePath === undefined) {
    return [id];
  } else {
    return [filePath];
  }
};

const getParser = () => {
  const aliasDivider = getConfiguration("wikilinkAliasDivider") as string;
  return unified()
    .use(remarkParse)
    .use(remarkWikiLink, {
      pageResolver: idResolver,
      aliasDivider: aliasDivider || ":",
    })
    .use(remarkFrontmatter);
};

export const parseFile = async (graph: Graph, filePath: string) => {
  // Normalize the file path using VS Code's URI system for cross-platform compatibility
  const fileUri = vscode.Uri.file(filePath);
  const normalizedFilePath = fileUri.fsPath;

  const buffer = await vscode.workspace.fs.readFile(fileUri);
  const content = new TextDecoder("utf-8").decode(buffer);
  const parser = getParser();
  const ast = parser.parse(content);

  const title: string | null = findTitle(ast);

  const index = graph.nodes.findIndex(
    (node) => node.path === normalizedFilePath,
  );

  if (!title) {
    if (index !== -1) {
      graph.nodes.splice(index, 1);
    }

    return;
  }

  if (index !== -1) {
    graph.nodes[index]!.label = title;
  } else {
    graph.nodes.push({
      id: id(normalizedFilePath),
      path: normalizedFilePath,
      label: title,
    });
  }

  // Remove edges based on an old version of this file.
  graph.edges = graph.edges.filter(
    (edge) => edge.source !== id(normalizedFilePath),
  );

  // Returns a list of decoded links (by default markdown only supports encoded URI)
  const links = findLinks(ast).map((uri) => decodeURI(uri));
  const currentFileDir = path.dirname(normalizedFilePath);
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  for (const link of links) {
    const targetPath = resolveLinkPath(link, currentFileDir, workspaceRoot);
    if (!targetPath) {
      continue;
    }

    graph.edges.push({
      source: id(normalizedFilePath),
      target: id(targetPath),
    });
  }
};

export const findFileId = async (filePath: string): Promise<string | null> => {
  const fileUri = vscode.Uri.file(filePath);
  const buffer = await vscode.workspace.fs.readFile(fileUri);
  const content = new TextDecoder("utf-8").decode(buffer);

  const match = content.match(FILE_ID_REGEXP);
  return match && match[1] ? match[1] : null;
};

export const learnFileId = async (_graph: Graph, filePath: string) => {
  // Normalize the file path using VS Code's URI system
  const normalizedPath = vscode.Uri.file(filePath).fsPath;

  const id = await findFileId(normalizedPath);
  if (id !== null) {
    idToPath[id] = normalizedPath;
  }

  const fileName = basename(normalizedPath);
  idToPath[fileName] = normalizedPath;

  const fileNameWithoutExt = fileName.split(".").slice(0, -1).join(".");
  idToPath[fileNameWithoutExt] = normalizedPath;
};

export const parseDirectory = async (
  graph: Graph,
  fileCallback: (graph: Graph, path: string) => Promise<void>,
) => {
  // `findFiles` is used here since it respects files excluded by either the
  // global or workspace level files.exclude config option.
  // Additionally, we use markdown-links.excludePatterns for more control.
  const includePattern = `**/*{${(getFileTypesSetting() as string[])
    .map((f) => `.${f}`)
    .join(",")}}`;

  const excludePatterns = getExcludePatternsSetting() as string[];
  const excludePattern =
    excludePatterns.length > 0 ? `{${excludePatterns.join(",")}}` : undefined;

  const files = await vscode.workspace.findFiles(
    includePattern,
    excludePattern,
  );

  const promises: Promise<void>[] = [];

  for (const file of files) {
    const hiddenFile = path.basename(file.fsPath).startsWith(".");
    if (!hiddenFile) {
      promises.push(fileCallback(graph, file.fsPath));
    }
  }

  await Promise.all(promises);
};
