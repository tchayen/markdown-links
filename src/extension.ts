import * as vscode from "vscode";
import { TextDecoder } from "util";
import * as path from "path";
import * as unified from "unified";
import * as markdown from "remark-parse";
import * as wikiLinkPlugin from "remark-wiki-link";
import * as frontmatter from "remark-frontmatter";
import * as md5 from "md5";

type Edge = {
  source: string;
  target: string;
};

type Node = {
  id: string;
  path: string;
  label: string;
};

// the first capturing group must return the id
const ID_REGEX = /(?:^|[^[])(\d{4}-\d{2}-\d{2}N\d+)/m;

const id = (path: string): string => md5(path);

let nodes: Node[] = [];
let edges: Edge[] = [];
let idToPath: Record<string, string> = {};

type MarkdownNode = {
  type: string;
  children?: MarkdownNode[];
  url?: string;
  value?: string;
  depth?: number;
  data?: {
    permalink?: string;
  };
};

const findLinks = (ast: MarkdownNode): string[] => {
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

const findTitle = (ast: MarkdownNode): string | null => {
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

const idResolver = (id: string): string[] => {
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

const parseFile = async (filePath: string) => {
  const buffer = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
  const content = new TextDecoder("utf-8").decode(buffer);
  const ast: MarkdownNode = parser.parse(content);

  console.log(filePath, ast);

  // TODO:
  // - parse that YAML
  // - wiki links?

  let title: string | null = findTitle(ast);

  if (!title) {
    return;
  }

  const index = nodes.findIndex((node) => node.path === filePath);
  if (index !== -1) {
    nodes[index].label = title;
  } else {
    nodes.push({ id: id(filePath), path: filePath, label: title });
  }

  // remove edges based on an old version of this file
  edges = edges.filter((edge) => edge.source !== filePath);

  const links = findLinks(ast);

  for (const link of links) {
    let target = link;
    if (!path.isAbsolute(link)) {
      const parentDirectory = filePath.split("/").slice(0, -1).join("/");
      target = path.normalize(`${parentDirectory}/${link}`);
    }

    edges.push({ source: id(filePath), target: id(target) });
  }
};

const findFileId = async (filePath: string): Promise<string | null> => {
  const buffer = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
  const content = new TextDecoder("utf-8").decode(buffer);

  const match = content.match(ID_REGEX);
  if (match) {
    return match[1];
  } else {
    return null;
  }
};

const parseForId = async (filePath: string) => {
  const id = await findFileId(filePath);
  if (id !== null) {
    idToPath[id] = filePath;
  }
};

const parseDirectory = async (
  directory: string,
  fileCallback: (path: string) => Promise<void>
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
      promises.push(parseDirectory(`${directory}/${fileName}`, fileCallback));
    } else if (isFile && markdownFile) {
      promises.push(fileCallback(`${directory}/${fileName}`));
    }
  }

  await Promise.all(promises);
};

const parseDirectoryForIds = async (directory: string) => {
  return await parseDirectory(directory, parseForId);
};

const parseDirectoryForLinks = async (directory: string) => {
  return await parseDirectory(directory, parseFile);
};

const exists = (id: string) => !!nodes.find((node) => node.id === id);

const filterNonExistingEdges = () => {
  edges = edges.filter((edge) => exists(edge.source) && exists(edge.target));
};

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

const getColumnSetting = (key: string) => {
  const column = vscode.workspace.getConfiguration("markdown-links")[key];
  return settingToValue[column] || vscode.ViewColumn.One;
};

const watch = (
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel
) => {
  if (vscode.workspace.rootPath === undefined) {
    return;
  }

  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(vscode.workspace.rootPath, "**/*.md"),
    false,
    false,
    false
  );

  // Watch file changes in case user adds a link.
  watcher.onDidChange(async (event) => {
    await parseFile(event.path);
    filterNonExistingEdges();
    panel.webview.postMessage({
      type: "refresh",
      payload: { nodes, edges },
    });
  });

  watcher.onDidDelete(async (event) => {
    const index = nodes.findIndex((node) => node.path === event.path);
    if (index === -1) {
      return;
    }

    nodes.splice(index, 1);
    edges = edges.filter(
      (edge) => edge.source !== event.path && edge.target !== event.path
    );

    panel.webview.postMessage({
      type: "refresh",
      payload: { nodes, edges },
    });
  });

  vscode.workspace.onDidRenameFiles(async (event) => {
    for (const file of event.files) {
      const previous = file.oldUri.path;
      const next = file.newUri.path;

      for (const edge of edges) {
        if (edge.source === previous) {
          edge.source = next;
        }

        if (edge.target === previous) {
          edge.target = next;
        }
      }

      for (const node of nodes) {
        if (node.path === previous) {
          node.path = next;
        }
      }

      panel.webview.postMessage({
        type: "refresh",
        payload: { nodes, edges },
      });
    }
  });

  panel.webview.onDidReceiveMessage(
    (message) => {
      if (message.type === "click") {
        const openPath = vscode.Uri.file(message.payload.path);
        const column = getColumnSetting("openColumn");

        vscode.workspace.openTextDocument(openPath).then((doc) => {
          vscode.window.showTextDocument(doc, column);
        });
      }
    },
    undefined,
    context.subscriptions
  );

  panel.onDidDispose(() => {
    watcher.dispose();
  });
};

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("markdown-links.showGraph", async () => {
      const column = getColumnSetting("showColumn");

      const panel = vscode.window.createWebviewPanel(
        "markdownLinks",
        "Markdown Links",
        column,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        }
      );

      if (vscode.workspace.rootPath === undefined) {
        vscode.window.showErrorMessage(
          "This command can only be activated in open directory"
        );
        return;
      }

      // Reset arrays.
      nodes = [];
      edges = [];

      await parseDirectoryForIds(vscode.workspace.rootPath);
      await parseDirectoryForLinks(vscode.workspace.rootPath);
      filterNonExistingEdges();

      const d3Uri = panel.webview.asWebviewUri(
        vscode.Uri.file(path.join(context.extensionPath, "static", "d3.min.js"))
      );

      panel.webview.html = await getWebviewContent(
        context,
        nodes,
        edges,
        d3Uri
      );

      watch(context, panel);
    })
  );
}

async function getWebviewContent(
  context: vscode.ExtensionContext,
  nodes: Node[],
  edges: Edge[],
  d3Uri: vscode.Uri
) {
  const webviewPath = vscode.Uri.file(
    path.join(context.extensionPath, "static", "webview.html")
  );
  const file = await vscode.workspace.fs.readFile(webviewPath);

  const text = new TextDecoder("utf-8").decode(file);

  const filled = text
    .replace("--REPLACE-WITH-D3-URI--", d3Uri.toString())
    .replace("let nodesData = [];", `let nodesData = ${JSON.stringify(nodes)}`)
    .replace("let linksData = [];", `let linksData = ${JSON.stringify(edges)}`);

  return filled;
}
