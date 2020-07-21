import * as vscode from "vscode";
import * as path from "path";
import * as unified from "unified";
import * as markdown from "remark-parse";
import * as wikiLinkPlugin from "remark-wiki-link";
import * as frontmatter from "remark-frontmatter";
import { MarkdownNode, Graph } from "./types";
import { TextDecoder } from "util";
import { findTitle, findLinks, id, FILE_ID_REGEXP, getFileTypesSetting, getConfiguration } from "./utils";
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
  const buffer = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
  const content = new TextDecoder("utf-8").decode(buffer);
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
    const isGraphFile = getFileTypesSetting().includes(fileName.substr(fileName.lastIndexOf('.')+1));

    if (isDirectory && !hiddenFile) {
      promises.push(
        parseDirectory(graph, `${directory}/${fileName}`, fileCallback)
      );
    } else if (isFile && isGraphFile) {
      promises.push(fileCallback(graph, `${directory}/${fileName}`));
    }
  }

  await Promise.all(promises);
};
