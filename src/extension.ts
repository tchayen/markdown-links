import * as vscode from "vscode";
import { TextDecoder } from "util";

const regex = /\[[A-z ]+\]\(\d+\.md\)/g;

type Edge = {
  source: string;
  target: string;
};

type Node = {
  path: string;
  label: string;
};

const nodes: Node[] = [];
const edges: Edge[] = [];

const parseFile = async (path: string) => {
  const buffer = await vscode.workspace.fs.readFile(vscode.Uri.file(path));
  const content = new TextDecoder("utf-8").decode(buffer);
  const title = content.match(/^\# .*/);

  if (title === null) {
    return;
  }

  nodes.push({ path, label: title[0].substring(2) });

  const files = content.match(regex) || [];
  for (const file of files) {
    const target = file.substring(file.indexOf("]") + 2, file.length - 1);
    edges.push({
      source: path,
      target: `${path.split("/").slice(0, -1).join("/")}/${target}`,
    });
  }
};

const parseDirectory = async (path: string) => {
  const files = await vscode.workspace.fs.readDirectory(vscode.Uri.file(path));

  for (const file of files) {
    if (file[1] === vscode.FileType.Directory && !file[0].startsWith(".")) {
      await parseDirectory(`${path}/${file[0]}`);
    } else if (file[1] === vscode.FileType.File && file[0].endsWith(".md")) {
      await parseFile(`${path}/${file[0]}`);
    }
  }
};

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("markdown-links.showGraph", async () => {
      const panel = vscode.window.createWebviewPanel(
        "markdownLinks",
        "Markdown Links",
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        }
      );

      if (vscode.workspace.rootPath === undefined) {
        // TODO: show message.
        return;
      }

      await parseDirectory(vscode.workspace.rootPath);

      panel.webview.html = getWebviewContent();

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
					background-color: #fff;
					margin: 0;
					padding: 0;
					overflow: hidden;
				}

				.nodes circle {
					cursor: pointer;
				}

				.text text {
					cursor: pointer;
				}
			</style>
			<script src="https://d3js.org/d3.v4.min.js"></script>
		</head>
		<body>
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

				//create somewhere to put the force directed graph
				var svg = d3.select("svg"),
					width = +svg.attr("width"),
					height = +svg.attr("height");

				const radius = 5;
				const stroke = 2;
				const fontSize = 14;

				var nodes_data = ${JSON.stringify(nodes)};

				//Sample links data
				//type: A for Ally, E for Enemy
				var links_data = ${JSON.stringify(edges)};

				const onClick = (d) => {
					vscode.postMessage({ type: 'click', payload: d })
				}

				//set up the simulation and add forces
				var simulation = d3.forceSimulation().nodes(nodes_data);

				var link_force = d3.forceLink(links_data).id(function (d) {
					return d.path;
				});

				var charge_force = d3.forceManyBody().strength(-100);

				var center_force = d3.forceCenter(width / 2, height / 2);

				simulation
					.force("charge_force", charge_force)
					.force("center_force", center_force)
					.force("links", link_force);

				//add tick instructions:
				simulation.on("tick", tickActions);

				//add encompassing group for the zoom
				var g = svg.append("g").attr("class", "everything");

				//draw lines for the links
				var link = g
					.append("g")
					.attr("class", "links")
					.selectAll("line")
					.data(links_data)
					.enter()
					.append("line")
					.attr("stroke-width", stroke)
					.style("stroke", linkColour);

				//draw circles for the nodes
				var node = g
					.append("g")
					.attr("class", "nodes")
					.selectAll("circle")
					.data(nodes_data)
					.enter()
					.append("circle")
					.attr("r", radius)
					.attr("fill", circleColour)
					.on("click", onClick);

				var text = g
					.append("g")
					.attr("class", "text")
					.selectAll("circle")
					.data(nodes_data)
					.enter()
					.append("text")
					.text(function (d) {
						return d.label.replace(/_*/g, "");
					})
					// .attr(
					// 	"font-family",
					// 	"-apple-system, BlinkMacSystemFont, “Roboto”, “Droid Sans”, “Helvetica Neue”, Helvetica, Arial, sans-serif"
					// )
					// .attr("font-size", \`\${fontSize}px\`)
					.attr("fill", "#444")
					.on("click", onClick);

				//add drag capabilities
				var drag_handler = d3
					.drag()
					.on("start", drag_start)
					.on("drag", drag_drag)
					.on("end", drag_end);

				drag_handler(node);

				//add zoom capabilities
				var zoom_handler = d3.zoom().on("zoom", zoom_actions);

				zoom_handler(svg);

				/** Functions **/

				//Function to choose what color circle we have
				//Let's return blue for males and red for females
				function circleColour(d) {
					return "#eee";
				}

				//Function to choose the line colour and thickness
				//If the link type is "A" return green
				//If the link type is "E" return red
				function linkColour(d) {
					return "#eee";
				}

				//Drag functions
				//d is the node
				function drag_start(d) {
					if (!d3.event.active) simulation.alphaTarget(0.3).restart();
					d.fx = d.x;
					d.fy = d.y;
				}

				//make sure you can't drag the circle outside the box
				function drag_drag(d) {
					d.fx = d3.event.x;
					d.fy = d3.event.y;
				}

				function drag_end(d) {
					if (!d3.event.active) simulation.alphaTarget(0);
					d.fx = null;
					d.fy = null;
				}

				//Zoom functions
				function zoom_actions() {
					const scale = d3.zoomTransform(this);
					g.attr("transform", d3.event.transform);

					text
						.attr("font-size", \`\${fontSize / scale.k}px\`)
						.attr("x", function (d) {
							return d.x;
						})
						.attr("y", function (d) {
							return d.y;
						});

					node.attr("r", radius / scale.k);

					link.attr("stroke-width", stroke / scale.k);
				}

				function tickActions() {
					//update circle positions each tick of the simulation
					const scale = d3.zoomTransform(this);
					node
						.attr("cx", function (d) {
							return d.x;
						})
						.attr("cy", function (d) {
							return d.y;
						});

					text
						.attr("x", function (d) {
							return d.x;
						})
						.attr("y", function (d) {
							return d.y;
						});

					//update link positions
					link
						.attr("x1", function (d) {
							return d.source.x;
						})
						.attr("y1", function (d) {
							return d.source.y;
						})
						.attr("x2", function (d) {
							return d.target.x;
						})
						.attr("y2", function (d) {
							return d.target.y;
						});
				}
			</script>
		</body>
	</html>
	`;
}
