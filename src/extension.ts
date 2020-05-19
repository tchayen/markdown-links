import * as vscode from "vscode";
import { TextDecoder } from "util";
import * as path from "path";
import * as unified from "unified";
import * as markdown from "remark-parse";
import * as md5 from "md5";

const fileName = `[A-z ]+`;
const notHttp = `(?!http)`;
const anythingButBracket = `[^\\)]+`;
const regex = new RegExp(
  `\\[${fileName}\\]\\(${notHttp}${anythingButBracket}\\.md\\)`,
  "g"
);

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
  const { theme, column } = vscode.workspace.getConfiguration("markdown-links");

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
        // TODO: show vscode message.
        return;
      }

      // Reset arrays.
      nodes = [];
      edges = [];

      await parseDirectory(vscode.workspace.rootPath);
      filterNonExistingEdges();

      panel.webview.html = getWebviewContent(theme, nodes, edges);

      watch(context, panel);
    })
  );
}

function getWebviewContent(theme: string, nodes: Node[], edges: Edge[]) {
  // TODO:
  // Use theme setting to override the default value.
  console.log("theme", theme);

  return `<!DOCTYPE html>
	<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body {
        margin: 0;
        padding: 0;
        overflow: hidden;
        background-color: #fff;
			}

			.links line {
				stroke: #ccc;
			}

      .nodes circle {
				cursor: pointer;
				fill: #999;
      }

      .text text {
				cursor: pointer;
				fill: #000;
			}

			// .vscode-dark .links line {
			// 	stroke: rgba(255, 255, 255, 0.2);
			// }

			// .vscode-dark .nodes circle {
			// 	fill: #fff;
			// }

			// .vscode-dark .text text {
			// 	fill: rgba(255, 255, 255, 0.8);
      // }

      .buttons {
        position: absolute;
        bottom: 0;
        right: 0;
        display: flex:
        flex-direction: row;
        margin: 16px;
      }

      button {
        border: none;
        border-radius: 4px;
        background-color: #eee;
        font-size: 13px;
        font-weight: bold;
        height: 24px;
        line-height: 24px;
        padding: 0 10px 0 10px;
        cursor: pointer;
      }

      button:hover {
        background-color: #ddd;
      }

      button:active {
        background-color: #ccc;
      }

      button:focus {
        outline: none;
      }

      span {
        color: #666;
      }
    </style>
    <script src="https://d3js.org/d3.v4.min.js"></script>
  </head>
  <body>
   <div class="buttons">
      <!--<button id="minus">-</button>
      <button id="reset">Reset</button>
      <button id="plus">+</button>-->
      <span id="zoom">1.00x</span>
    </div>
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

      const radius = 3;
      const stroke = 1;
			const fontSize = 14;
			const minZoom = 0.8;
      const maxZoom = 1.5;
      const ticks = 300;

      let nodesData = ${JSON.stringify(nodes)};
			let linksData = ${JSON.stringify(edges)};

			console.log(JSON.stringify({ nodesData, linksData}, null, 2));

      const onClick = (d) => {
        vscode.postMessage({ type: "click", payload: d });
      };

      const sameNodes = (previous, next) => {
        if (next.length !== previous.length) {
          return false;
        }

        const set = new Set();
        for (const node of previous) {
          set.add(node.path);
        }

        for (const node of next) {
          if (!set.has(node.path)) {
            return false;
          }
        }

        return true;
      }

      const sameEdges = (previous, next) => {
        if (next.length !== previous.length) {
          return false;
        }

        const set = new Set();
        for (const edge of previous) {
          set.add(\`\${edge.source.path}-\${edge.target.path}\`);
        }

        for (const edge of next) {
          if (!set.has(\`\${edge.source}-\${edge.target}\`)) {
            return false;
          }
        }

        return true;
      }

			window.addEventListener("message", (event) => {
        const message = event.data;
        switch (message.type) {
          case "refresh":
            const { nodes, edges } = message.payload;

            if (sameNodes(nodesData, nodes) && sameEdges(linksData, edges)) {
              return;
            }

						nodesData = nodes;
						linksData = edges;
						restart();
            break;
        }
      });

			const zoomHandler = d3.zoom()
				.scaleExtent([0.2, 3])
				//.translateExtent([[0,0], [width, height]])
				//.extent([[0, 0], [width, height]])
				.on("zoom", zoomActions);

      zoomHandler(svg);

      let simulation = d3
        .forceSimulation(nodesData)
        .force("charge", d3.forceManyBody().strength(-300))
        .force(
          "link",
          d3
            .forceLink(linksData)
            .id((d) => d.path)
            .distance(70)
        )
        .force("center", d3.forceCenter(width / 2, height / 2))
        .on("tick", ticked)
        .stop();

      let g = svg.append("g");
      let link = g.append("g").attr("class", "links").selectAll(".link");
      let node = g.append("g").attr("class", "nodes").selectAll(".node");
      let text = g.append("g").attr("class", "text").selectAll(".text");

      restart();

			function zoomActions() {
				const scale = d3.event.transform;
				g.attr("transform", scale);
				const font = scale.k >= 1 ? fontSize / scale.k : fontSize;
        text.attr("font-size", \`\${font}px\`);
        node.attr("font-size", \`\${font}px\`);
        link.attr("stroke-width", scale.k >= 1 ? stroke / scale.k : stroke);
        node.attr("r", scale.k >= 1 ? radius / scale.k : radius);
        document.getElementById("zoom").innerHTML = \`\${scale.k.toFixed(2)}x\`;
			}

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
        simulation.stop();

        for (let i = 0; i < ticks; i++) {
          simulation.tick();
        }

        ticked();
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
