import * as vscode from "vscode";
import { TextDecoder } from "util";
import * as path from "path";
import { parseFile, parseDirectory, learnFileId } from "./parsing";
import { filterNonExistingEdges, getColumnSetting, getConfiguration, getFileTypesSetting } from "./utils";
import { Graph } from "./types";

const watch = (
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel,
  graph: Graph
) => {
  if (vscode.workspace.rootPath === undefined) {
    return;
  }

  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(vscode.workspace.rootPath, `**/*{${getFileTypesSetting().join(",")}}`),
    false,
    false,
    false
  );

  const sendGraph = () => {
    panel.webview.postMessage({
      type: "refresh",
      payload: graph,
    });
  };

  // Watch file changes in case user adds a link.
  watcher.onDidChange(async (event) => {
    await parseFile(graph, event.path);
    filterNonExistingEdges(graph);
    sendGraph();
  });

  watcher.onDidDelete(async (event) => {
    const index = graph.nodes.findIndex((node) => node.path === event.path);
    if (index === -1) {
      return;
    }

    graph.nodes.splice(index, 1);
    graph.edges = graph.edges.filter(
      (edge) => edge.source !== event.path && edge.target !== event.path
    );

    sendGraph();
  });

  vscode.workspace.onDidOpenTextDocument(async (event) => {
    panel.webview.postMessage({
      type: "fileOpen",
      payload: { path: event.fileName },
    });
  });

  vscode.workspace.onDidRenameFiles(async (event) => {
    for (const file of event.files) {
      const previous = file.oldUri.path;
      const next = file.newUri.path;

      for (const edge of graph.edges) {
        if (edge.source === previous) {
          edge.source = next;
        }

        if (edge.target === previous) {
          edge.target = next;
        }
      }

      for (const node of graph.nodes) {
        if (node.path === previous) {
          node.path = next;
        }
      }

      sendGraph();
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

      const graph: Graph = {
        nodes: [],
        edges: [],
      };

      await parseDirectory(graph, vscode.workspace.rootPath, learnFileId);
      await parseDirectory(graph, vscode.workspace.rootPath, parseFile);
      filterNonExistingEdges(graph);

      const d3Uri = panel.webview.asWebviewUri(
        vscode.Uri.file(path.join(context.extensionPath, "static", "d3.min.js"))
      );

      panel.webview.html = await getWebviewContent(context, graph, d3Uri);

      watch(context, panel, graph);
    })
  );

  const shouldAutoStart = getConfiguration("autoStart");

  if (shouldAutoStart) {
    vscode.commands.executeCommand("markdown-links.showGraph");
  }
}

async function getWebviewContent(
  context: vscode.ExtensionContext,
  graph: Graph,
  d3Uri: vscode.Uri
) {
  const webviewPath = vscode.Uri.file(
    path.join(context.extensionPath, "static", "webview.html")
  );
  const file = await vscode.workspace.fs.readFile(webviewPath);

  const text = new TextDecoder("utf-8").decode(file);

  const filled = text
    .replace("--REPLACE-WITH-D3-URI--", d3Uri.toString())
    .replace(
      "let nodesData = [];",
      `let nodesData = ${JSON.stringify(graph.nodes)}`
    )
    .replace(
      "let linksData = [];",
      `let linksData = ${JSON.stringify(graph.edges)}`
    );

  return filled;
}
