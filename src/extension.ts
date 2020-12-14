import * as vscode from "vscode";
import { TextDecoder } from "util";
import * as path from "path";
import { parseFile, parseDirectory, learnFileId } from "./parsing";
import {
  filterNonExistingEdges,
  getColumnSetting,
  getConfiguration,
  getFileTypesSetting,
} from "./utils";
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
    new vscode.RelativePattern(
      vscode.workspace.rootPath,
      `**/*{${getFileTypesSetting().join(",")}}`
    ),
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

  // Watch file creation in case user adds a new file.
  watcher.onDidCreate(async (event) => {
    await parseFile(graph, event.path);
    filterNonExistingEdges(graph);
    sendGraph();
  });

  watcher.onDidDelete(async (event) => {
    const filePath = path.normalize(event.path);
    const index = graph.nodes.findIndex((node) => node.path === filePath);
    if (index === -1) {
      return;
    }

    graph.nodes.splice(index, 1);
    graph.edges = graph.edges.filter(
      (edge) => edge.source !== filePath && edge.target !== filePath
    );

    filterNonExistingEdges(graph);
    sendGraph();
  });

  vscode.window.onDidChangeActiveTextEditor(async (event) => {
    if (!event) {
      return;
    }
    panel.webview.postMessage({
      type: "fileOpen",
      payload: { path: event!.document.fileName },
    });
  });

  vscode.workspace.onDidRenameFiles(async (event) => {
    for (const file of event.files) {
      const previous = path.normalize(file.oldUri.path);
      const next = path.normalize(file.newUri.path);

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
      if (message.type === "ready") {
        sendGraph();
      }
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

      await parseDirectory(graph, learnFileId);
      await parseDirectory(graph, parseFile);
      filterNonExistingEdges(graph);

      panel.webview.html = await getWebviewContent(context, panel);

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
  panel: vscode.WebviewPanel
) {
  const webviewPath = vscode.Uri.file(
    path.join(context.extensionPath, "static", "webview.html")
  );
  const file = await vscode.workspace.fs.readFile(webviewPath);

  const text = new TextDecoder("utf-8").decode(file);

  const webviewUri = (fileName: string) =>
    panel.webview
      .asWebviewUri(
        vscode.Uri.file(path.join(context.extensionPath, "static", fileName))
      )
      .toString();

  const graphDirectory = path.join("graphs", getConfiguration("graphType"));
  const textWithVariables = text
    .replace(
      "${graphPath}",
      "{{" + path.join(graphDirectory, "graph.js") + "}}"
    )
    .replace(
      "${graphStylesPath}",
      "{{" + path.join(graphDirectory, "graph.css") + "}}"
    );

  // Basic templating. Will replace {{someScript.js}} with the
  // appropriate webview URI.
  const filled = textWithVariables.replace(/\{\{.*\}\}/g, (match) => {
    const fileName = match.slice(2, -2).trim();
    return webviewUri(fileName);
  });

  return filled;
}
