import * as vscode from "vscode";
import { TextDecoder } from "util";
import * as path from "path";

const regex = /\[[A-z ]+\]\(.*\.md\)/g;

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

const parseFile = async (filePath: string) => {
  const buffer = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
  const content = new TextDecoder("utf-8").decode(buffer);
  const title = content.match(/^\# .*/);

  if (title === null) {
    return;
  }

  const index = nodes.findIndex((node) => node.path === filePath);
  if (index !== -1) {
    nodes[index].label = title[0].substring(2);
  } else {
    nodes.push({ path: filePath, label: title[0].substring(2) });
  }

  edges = edges.filter((edge) => edge.source !== filePath);

  const files = content.match(regex) || [];
  for (const file of files) {
    const target = file.substring(file.indexOf("]") + 2, file.length - 1);
    edges.push({
      source: filePath,
      target: path.normalize(
        `${filePath.split("/").slice(0, -1).join("/")}/${target}`
      ),
    });
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

const settingToValue = {
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

export function activate(context: vscode.ExtensionContext) {
  const {
    theme,
    column,
    ignoreDirectories,
    ignoreFiles,
  } = vscode.workspace.getConfiguration("markdown-links");

  context.subscriptions.push(
    vscode.commands.registerCommand("markdown-links.showGraph", async () => {
      const panel = vscode.window.createWebviewPanel(
        "markdownLinks",
        "Markdown Links",
        settingToValue[column as any] as any,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        }
      );

      if (vscode.workspace.rootPath === undefined) {
        // TODO: show message.
        return;
      }

      nodes = [];
      edges = [];

      await parseDirectory(vscode.workspace.rootPath);

      panel.webview.html = getWebviewContent();

      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(vscode.workspace.rootPath, "**/*.md"),
        false,
        false,
        false
      );

      watcher.onDidChange(async (event) => {
        await parseFile(event.path);
        console.log(nodes);
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
    })
  );
}

function getWebviewContent() {
  return `<!DOCTYPE html>
	<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body {
        margin: 0;
        padding: 0;
        overflow: hidden;
			}

			.links line {
				stroke: rgba(0, 0, 0, 0.2);
			}

      .nodes circle {
				cursor: pointer;
				fill: rgba(0, 0, 0, 0.2);
      }

      .text text {
				cursor: pointer;
				fill: rgba(0, 0, 0, 0.8);
			}

			body.vscode-dark .links line {
				stroke: rgba(255, 255, 255, 0.2);
			}

			body.vscode-dark .nodes circle {
				fill: rgba(255, 255, 255, 0.2);
			}

			body.vscode-dark .text text {
				fill: rgba(255, 255, 255, 0.8);
			}
    </style>
    <script src="https://d3js.org/d3.v4.min.js"></script>
  </head>
  <body class="vscode-dark">
    <script>
      const vscode = acquireVsCodeApi();

      const element = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg"
      );
      element.setAttribute("width", window.innerWidth);
      element.setAttribute("height", window.innerHeight);
      document.body.appendChild(element);

      function reportWindowSize() {
        element.setAttribute("width", window.innerWidth);
        element.setAttribute("height", window.innerHeight);
      }

      window.onresize = reportWindowSize;

      const svg = d3.select("svg");
      const width = +svg.attr("width");
      const height = +svg.attr("height");

      const radius = 5;
      const stroke = 2;
      const fontSize = 14;

      let nodesData = ${JSON.stringify(nodes)};
      let linksData = ${JSON.stringify(edges)};

      const onClick = (d) => {
        vscode.postMessage({ type: "click", payload: d });
			};

			window.addEventListener("message", (event) => {
        const message = event.data;
        switch (message.type) {
          case "refresh":
						nodesData = message.payload.nodes;
						console.log(nodesData);
						linksData = message.payload.edges;
						restart();
            break;
        }
      });

      const zoomHandler = d3.zoom().on("zoom", zoomActions);

      zoomHandler(svg);

      function zoomActions() {
        const scale = d3.zoomTransform(this);
        g.attr("transform", d3.event.transform);
        text.attr("font-size", \`\${fontSize / scale.k}px\`);
        node.attr("r", radius / scale.k);
        link.attr("stroke-width", stroke / scale.k);
      }

      let simulation = d3
        .forceSimulation(nodesData)
        .force("charge", d3.forceManyBody().strength(-500))
        .force(
          "link",
          d3
            .forceLink(linksData)
            .id((d) => d.path)
            .distance(70)
        )
        .force("center", d3.forceCenter(width / 2, height / 2))
        .on("tick", ticked);

      let g = svg.append("g");
      let link = g.append("g").attr("class", "links").selectAll(".link");
      let node = g.append("g").attr("class", "nodes").selectAll(".node");
      let text = g.append("g").attr("class", "text").selectAll(".text");

      restart();

      function restart() {
        node = node.data(nodesData, (d) => d.path);
        node.exit().remove();
        node = node
          .enter()
          .append("circle")
          .attr("r", radius)
          .on("click", onClick)
          .merge(node);

        link = link.data(linksData, (d) => \`\${d.source.path}-\${d.target.path}\`);
        link.exit().remove();
        link = link
          .enter()
          .append("line")
          .attr("stroke-width", stroke)
          .merge(link);

					console.log(2, nodesData)
        text = text.data(nodesData, (d) => d.label);
        text.exit().remove();
        text = text
          .enter()
          .append("text")
          .text((d) => d.label.replace(/_*/g, ""))
          .attr("font-size", \`\${fontSize}px\`)
          .on("click", onClick)
          .merge(text);

        simulation.nodes(nodesData);
        simulation.force("link").links(linksData);
        simulation.alpha(1).restart();
      }

      function ticked() {
        node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
        text.attr("x", (d) => d.x).attr("y", (d) => d.y);
        link
          .attr("x1", (d) => d.source.x)
          .attr("y1", (d) => d.source.y)
          .attr("x2", (d) => d.target.x)
          .attr("y2", (d) => d.target.y);
      }
    </script>
  </body>
</html>
	`;
}
