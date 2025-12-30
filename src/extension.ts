import * as vscode from "vscode";
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
  graph: Graph,
) => {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return;
  }

  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(
      workspaceFolder,
      `**/*{${getFileTypesSetting().join(",")}}`,
    ),
    false,
    false,
    false,
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
      (edge) => edge.source !== filePath && edge.target !== filePath,
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
    async (message) => {
      if (message.type === "ready") {
        sendGraph();
      }
      if (message.type === "click") {
        try {
          const openPath = vscode.Uri.file(message.payload.path);
          const column = getColumnSetting("openColumn");
          const doc = await vscode.workspace.openTextDocument(openPath);
          await vscode.window.showTextDocument(doc, column);
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to open file: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    },
    undefined,
    context.subscriptions,
  );

  panel.onDidDispose(() => {
    watcher.dispose();
  });
};

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("markdown-links.showGraph", async () => {
      try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
          vscode.window.showErrorMessage(
            "This command can only be activated in an open workspace",
          );
          return;
        }

        const column = getColumnSetting("showColumn");

        const panel = vscode.window.createWebviewPanel(
          "markdownLinks",
          "Markdown Links",
          column,
          {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
              vscode.Uri.joinPath(context.extensionUri, "static"),
            ],
          },
        );

        const graph: Graph = {
          nodes: [],
          edges: [],
        };

        await parseDirectory(graph, learnFileId);
        await parseDirectory(graph, parseFile);
        filterNonExistingEdges(graph);

        panel.webview.html = await getWebviewContent(context, panel);

        watch(context, panel, graph);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to show graph: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }),
  );

  const shouldAutoStart = getConfiguration("autoStart");

  if (shouldAutoStart) {
    vscode.commands.executeCommand("markdown-links.showGraph");
  }
}

export function deactivate() {
  // Cleanup resources if needed
}

async function getWebviewContent(
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel,
) {
  const webviewPath = vscode.Uri.joinPath(
    context.extensionUri,
    "static",
    "webview.html",
  );
  const file = await vscode.workspace.fs.readFile(webviewPath);

  const text = new TextDecoder().decode(file);

  const webviewUri = (fileName: string) =>
    panel.webview
      .asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "static", fileName))
      .toString();

  // Generate a nonce for Content Security Policy
  const nonce = getNonce();

  const graphType = getConfiguration("graphType") as string;
  const graphDirectory = path.posix.join("graphs", graphType);
  const textWithVariables = text
    .replace(
      "${graphPath}",
      "{{" + path.posix.join(graphDirectory, "graph.js") + "}}",
    )
    .replace(
      "${graphStylesPath}",
      "{{" + path.posix.join(graphDirectory, "graph.css") + "}}",
    )
    .replace("${cspSource}", panel.webview.cspSource)
    .replace("${nonce}", nonce);

  // Basic templating. Will replace {{someScript.js}} with the
  // appropriate webview URI.
  const filled = textWithVariables.replace(/\{\{.*\}\}/g, (match) => {
    const fileName = match.slice(2, -2).trim();
    return webviewUri(fileName);
  });

  return filled;
}

function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
