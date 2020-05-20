import * as vscode from "vscode";
import { TextDecoder } from "util";
import * as path from "path";
import * as unified from "unified";
import * as markdown from "remark-parse";
import * as md5 from "md5";

const fileName = `[A-z ]+`;
const notHttp = `(?!http)`;
const anythingButBracket = `[^\\)]+`;

type Edge = {
  source: string;
  target: string;
};

type Node = {
  path: string;
  label: string;
};

let nodes: Node[] = [];
let edges: Edge[] = [];

type MarkdownNode = {
  type: string;
  children?: MarkdownNode[];
  url?: string;
  value?: string;
  depth?: number;
};

const findLinks = (ast: MarkdownNode): string[] => {
  if (ast.type === "link" || ast.type === "definition") {
    return [ast.url!];
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

const parseFile = async (source: string) => {
  const buffer = await vscode.workspace.fs.readFile(vscode.Uri.file(source));
  const content = new TextDecoder("utf-8").decode(buffer);
  const ast: MarkdownNode = unified().use(markdown).parse(content);

  let title = null;
  if (
    ast.children &&
    ast.children.length > 0 &&
    ast.children[0].type === "heading" &&
    ast.children[0].depth === 1 &&
    ast.children[0].children &&
    ast.children[0].children.length > 0
  ) {
    title = ast.children[0].children[0].value!;
  }

  if (!title) {
    return;
  }

  const index = nodes.findIndex((node) => node.path === source);
  if (index !== -1) {
    nodes[index].label = title;
  } else {
    nodes.push({ path: source, label: title });
  }

  edges = edges.filter((edge) => edge.source !== source);

  const links = findLinks(ast);

  for (const link of links) {
    const target = path.normalize(
      `${source.split("/").slice(0, -1).join("/")}/${link}`
    );

    edges.push({ source, target });
  }
};

const parseDirectory = async (filePath: string) => {
  const files = await vscode.workspace.fs.readDirectory(
    vscode.Uri.file(filePath)
  );

  for (const file of files) {
    if (file[1] === vscode.FileType.Directory && !file[0].startsWith(".")) {
      await parseDirectory(`${filePath}/${file[0]}`);
    } else if (file[1] === vscode.FileType.File && file[0].endsWith(".md")) {
      await parseFile(`${filePath}/${file[0]}`);
    }
  }
};

const exists = (path: string) => !!nodes.find((node) => node.path === path);

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
      if (message.type) {
        const openPath = vscode.Uri.file(message.payload.path);
        vscode.workspace.openTextDocument(openPath).then((doc) => {
          vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
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
  const { column } = vscode.workspace.getConfiguration("markdown-links");
  const setting = settingToValue[column] || vscode.ViewColumn.One;

  context.subscriptions.push(
    vscode.commands.registerCommand("markdown-links.showGraph", async () => {
      const panel = vscode.window.createWebviewPanel(
        "markdownLinks",
        "Markdown Links",
        setting,
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

      await parseDirectory(vscode.workspace.rootPath);
      filterNonExistingEdges();

      // /Users/tchayen/lab/markdown-links/node_modules/d3/build/d3.min.js

      const d3Uri = panel.webview.asWebviewUri(
        vscode.Uri.file(
          path.join(
            context.extensionPath,
            "node_modules",
            "d3",
            "build",
            "d3.min.js"
          )
        )
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
  const file = await vscode.workspace.fs.readFile(
    vscode.Uri.file(path.join(context.extensionPath, "src", "webview.html"))
  );

  const text = new TextDecoder("utf-8").decode(file);

  const filled = text
    .replace("--REPLACE-WITH-D3-URI--", d3Uri.toString())
    .replace("let nodesData = [];", `let nodesData = ${JSON.stringify(nodes)}`)
    .replace("let linksData = [];", `let linksData = ${JSON.stringify(edges)}`);

  return filled;
}
