import * as vscode from "vscode";
import * as path from "path";
import * as unified from "unified";
import * as markdown from "remark-parse";
import * as wikiLinkPlugin from "remark-wiki-link";
import * as frontmatter from "remark-frontmatter";
import { MarkdownNode, Graph, Node } from "./types";
import { TextDecoder } from "util";
import {
  findTitle,
  findLinks,
  id,
  FILE_ID_REGEXP,
  getFileTypesSetting,
  getConfiguration,
  getTitleMaxLength,
} from "./utils";
import { basename } from "path";

let idToPath: Record<string, string> = {};

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

export const parseFile = async (graph: Graph, filePath: string) => {
  filePath = path.normalize(filePath);
  const buffer = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
  const content = new TextDecoder("utf-8").decode(buffer);
  const ast: MarkdownNode = parser.parse(content);

  let title: string | null = findTitle(ast);

  const node = graph.getNodeByPath(filePath);
  if (!title) {
    if (node) {
      graph.removeNode(node.id);
    }
    return;
  }

  const nodeId = node ? node.id : id(filePath);
  if (node) {
    node.label = title;
    // Remove edges based on an old version of this file.
    graph.clearNodeLinks(nodeId);
  } else {
    graph.addNode(new Node(nodeId, filePath, title));
  }

  // Returns a list of decoded links (by default markdown only supports encoded URI)
  const links = findLinks(ast).map((uri) => decodeURI(uri));
  const parentDirectory = filePath.split(path.sep).slice(0, -1).join(path.sep);

  for (const link of links) {
    let target = path.normalize(link);
    if (!path.isAbsolute(link)) {
      target = path.normalize(`${parentDirectory}/${link}`);
    }

    graph.addLink(nodeId, id(target));
  }
};

export const findFileId = async (filePath: string): Promise<string | null> => {
  const buffer = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
  const content = new TextDecoder("utf-8").decode(buffer);

  const match = content.match(FILE_ID_REGEXP);
  return match ? match[1] : null;
};

export const learnFileId = async (_graph: Graph, filePath: string) => {
  const id = await findFileId(filePath);
  if (id !== null) {
    idToPath[id] = filePath;
  }

  const fileName = basename(filePath);
  idToPath[fileName] = filePath;

  const fileNameWithoutExt = fileName.split(".").slice(0, -1).join(".");
  idToPath[fileNameWithoutExt] = filePath;
};

export const parseDirectory = async (
  graph: Graph,
  fileCallback: (graph: Graph, path: string) => Promise<void>
) => {
  // `findFiles` is used here since it respects files excluded by either the
  // global or workspace level files.exclude config option.
  const files = await vscode.workspace.findFiles(
    `**/*{${(getFileTypesSetting() as string[]).map((f) => `.${f}`).join(",")}}`
  );

  const promises: Promise<void>[] = [];

  for (const file of files) {
    const hiddenFile = path.basename(file.path).startsWith(".");
    if (!hiddenFile) {
      promises.push(fileCallback(graph, file.path));
    }
  }

  await Promise.all(promises);
};
