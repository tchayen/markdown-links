import * as vscode from "vscode";
import * as path from "path";
import * as unified from "unified";
import * as markdown from "remark-parse";
import * as wikiLinkPlugin from "remark-wiki-link";
import * as frontmatter from "remark-frontmatter";
import { MarkdownNode, Graph } from "./types";
import { TextDecoder } from "util";
import { findTitle, findLinks, id, getFileIdRegexp } from "./utils";

let idToPath: Record<string, string> = {};

/**
 * ??
 * @param id ??
 */
export const idResolver = (id: string) => {
  const filePath = idToPath[id];
  if (filePath === undefined) {
    return [id];
  } else {
    return [filePath];
  }
};

const parser = unified()
  .use(markdown)
  .use(wikiLinkPlugin, { pageResolver: idResolver })
  .use(frontmatter);

/**
 * Wrapper for `parseFile` that reads a file. Uses `vscode.workspace.fs`.
 * @param graph object that will be altered.
 * @param filePath absolute path to the file. Used for reading the file.
 */
export const processFile = async (graph: Graph, filePath: string) => {
  const buffer = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
  const content = new TextDecoder("utf-8").decode(buffer);

  return parseFile(graph, filePath, content);
};

/**
 * Alters given graph, adding a node and some edges if file is properly
 * structured.
 * @param graph object that will be altered.
 * @param filePath absolute path to the file. Isn't used for reading the file.
 * @param content content of the file as utf-8 string.
 */
export const parseFile = (graph: Graph, filePath: string, content: string) => {
  const ast: MarkdownNode = parser.parse(content);

  let title: string | null = findTitle(ast);

  const index = graph.nodes.findIndex((node) => node.path === filePath);

  if (!title) {
    if (index !== -1) {
      graph.nodes.splice(index, 1);
    }

    return;
  }

  if (index !== -1) {
    graph.nodes[index].label = title;
  } else {
    graph.nodes.push({ id: id(filePath), path: filePath, label: title });
  }

  // Remove edges based on an old version of this file.
  graph.edges = graph.edges.filter((edge) => edge.source !== id(filePath));

  const links = findLinks(ast);
  const parentDirectory = filePath.split("/").slice(0, -1).join("/");

  for (const link of links) {
    let target = link;
    if (!path.isAbsolute(link)) {
      target = path.normalize(`${parentDirectory}/${link}`);
    }

    graph.edges.push({ source: id(filePath), target: id(target) });
  }
};

/**
 * For given file path, returns its ID or null. Uses `vscode.workspace.fs`.
 * @param filePath absolute path of the file.
 */
export const findFileId = async (filePath: string): Promise<string | null> => {
  const buffer = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
  const content = new TextDecoder("utf-8").decode(buffer);

  const match = content.match(getFileIdRegexp());
  return match ? match[1] : null;
};

/**
 * Populates `idToPath` with ID from the file if one is found there.
 * @param _graph unused.
 * @param filePath absolute path of the file.
 */
export const learnFileId = async (_graph: Graph, filePath: string) => {
  const id = await findFileId(filePath);
  if (id !== null) {
    idToPath[id] = filePath;
  }
};

/**
 * Recursively reads content of the given directory and calls specified
 * callback on each file (not a symlink) with `*.md` extensions.
 * @param graph object to be altered.
 * @param directory path of the directory.
 * @param fileCallback
 */
export const parseDirectory = async (
  graph: Graph,
  directory: string,
  fileCallback: (graph: Graph, path: string) => Promise<void>
) => {
  const files = await vscode.workspace.fs.readDirectory(
    vscode.Uri.file(directory)
  );

  const promises: Promise<void>[] = [];

  for (const file of files) {
    const fileName = file[0];
    const fileType = file[1];
    const isDirectory = fileType === vscode.FileType.Directory;
    const isFile = fileType === vscode.FileType.File;
    const hiddenFile = fileName.startsWith(".");
    const markdownFile = fileName.endsWith(".md");

    if (isDirectory && !hiddenFile) {
      promises.push(
        parseDirectory(graph, `${directory}/${fileName}`, fileCallback)
      );
    } else if (isFile && markdownFile) {
      promises.push(fileCallback(graph, `${directory}/${fileName}`));
    }
  }

  await Promise.all(promises);
};
