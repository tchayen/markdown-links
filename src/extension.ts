import * as vscode from "vscode";
import { TextDecoder } from "util";
import * as path from "path";
import { parseFile, forEachFile, learnFileId } from "./parsing";
import {
  filterNonExistingEdges,
  getColumnSetting,
  getConfiguration,
  getFileGlob,
  generateBacklinks,
  id,
} from "./utils";
import { State } from "./types";

const watch = (
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel,
  state: State
) => {
  if (vscode.workspace.rootPath === undefined) {
    return;
  }

  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(vscode.workspace.rootPath, getFileGlob()),
    false,
    false,
    false
  );

  const sendGraph = () => {
    panel.webview.postMessage({
      type: "refresh",
      payload: state,
    });
  };

  // Watch file changes in case user adds a link.
  watcher.onDidChange(async (event) => {
    await parseFile(state, event.path);
    filterNonExistingEdges(state);
    generateBacklinks(state);
    sendGraph();
  });

  // Watch file creation in case user adds a new file
  watcher.onDidCreate(async (event) => {
    await parseFile(state, event.path);
    filterNonExistingEdges(state);
    generateBacklinks(state);
    sendGraph();
  });

  watcher.onDidDelete(async (event) => {
    let nodeId = id(event.path);
    let node = state.graph[nodeId];

    if (!node) {
      return;
    }

    delete state.graph[nodeId];
    for (const nid in state.graph) {
      const n = state.graph[nid];
      n.links = n.links.filter((link) => link !== nodeId);
    }

    sendGraph();
  });

  vscode.workspace.onDidOpenTextDocument(async (event) => {
    let filePath = event.uri.path.replace(".git", "");
    let nodeId = id(filePath);
    if (state.graph[nodeId]) {
      state.currentNode = nodeId;
      sendGraph();
    }
  });

  vscode.workspace.onDidRenameFiles(async (event) => {
    for (const file of event.files) {
      const prev = file.oldUri.path;
      const next = file.newUri.path;
      const prevId = id(prev);
      const nextId = id(next);

      if (state.graph[prevId]) {
        state.graph[nextId] = state.graph[prevId];
        state.graph[nextId].path = next;
        state.graph[nextId].id = nextId;
        delete state.graph[prevId];
      }

      for (const nodeId in state.graph) {
        const node = state.graph[nodeId];
        node.links = node.links.map((link) =>
          link === prevId ? nextId : link
        );
      }
    }

    sendGraph();
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
      const currentFilePath =
        vscode.window.activeTextEditor?.document?.uri?.path || "";
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

      const state: State = { graph: {}, currentNode: undefined };

      await forEachFile(state, learnFileId);
      await forEachFile(state, parseFile);
      filterNonExistingEdges(state);
      generateBacklinks(state);

      if (currentFilePath && state.graph[id(currentFilePath)]) {
        state.currentNode = id(currentFilePath);
      }

      panel.webview.html = await getWebviewContent(context, panel);

      watch(context, panel, state);
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

  // Basic templating. Will replace {{someScript.js}} with the
  // appropriate webview URI.
  const filled = text.replace(/\{\{.*\}\}/g, (match) => {
    const fileName = match.slice(2, -2).trim();
    return webviewUri(fileName);
  });

  return filled;
}
