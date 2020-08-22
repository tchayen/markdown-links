const RADIUS = 4;
const ACTIVE_RADIUS = 6;
const STROKE = 1;
const FONT_SIZE = 14;
const TICKS = 5000;
const FONT_BASELINE = 15;

let nodesData = [];
let linksData = [];

const vscode = acquireVsCodeApi();

const onClick = (d) => {
  vscode.postMessage({ type: "click", payload: d });
};

const sameNodes = (previous, next) => {
  if (next.length !== previous.length) {
    return false;
  }

  const map = new Map();
  for (const node of previous) {
    map.set(node.id, node.label);
  }

  for (const node of next) {
    const found = map.get(node.id);
    if (!found || found !== node.title) {
      return false;
    }
  }

  return true;
};

const sameEdges = (previous, next) => {
  if (next.length !== previous.length) {
    return false;
  }

  const set = new Set();
  for (const edge of previous) {
    set.add(`${edge.source.id}-${edge.target.id}`);
  }

  for (const edge of next) {
    if (!set.has(`${edge.source}-${edge.target}`)) {
      return false;
    }
  }

  return true;
};

const element = document.createElementNS("http://www.w3.org/2000/svg", "svg");
element.setAttribute("width", window.innerWidth);
element.setAttribute("height", window.innerHeight);
document.body.appendChild(element);

const reportWindowSize = () => {
  element.setAttribute("width", window.innerWidth);
  element.setAttribute("height", window.innerHeight);
};

window.onresize = reportWindowSize;

const svg = d3.select("svg");
const width = Number(svg.attr("width"));
const height = Number(svg.attr("height"));
let zoomLevel = 1;

console.log(JSON.stringify({ nodesData, linksData }, null, 2));

const simulation = d3
  .forceSimulation(nodesData)
  .force("charge", d3.forceManyBody().strength(-300))
  .force(
    "link",
    d3
      .forceLink(linksData)
      .id((d) => d.id)
      .distance(70)
  )
  .force("center", d3.forceCenter(width / 2, height / 2))
  .stop();

const g = svg.append("g");
let link = g.append("g").attr("class", "links").selectAll(".link");
let node = g.append("g").attr("class", "nodes").selectAll(".node");
let text = g.append("g").attr("class", "text").selectAll(".text");

const resize = () => {
  if (d3.event) {
    const scale = d3.event.transform;
    zoomLevel = scale.k;
    g.attr("transform", scale);
  }

  const zoomOrKeep = (value) => (zoomLevel >= 1 ? value / zoomLevel : value);

  const font = Math.max(Math.round(zoomOrKeep(FONT_SIZE)), 1);

  text.attr("font-size", `${font}px`);
  text.attr("y", (d) => d.y - zoomOrKeep(FONT_BASELINE));
  link.attr("stroke-width", zoomOrKeep(STROKE));
  node.attr("r", zoomOrKeep(RADIUS));
  svg
    .selectAll("circle")
    .filter((_d, i, nodes) => d3.select(nodes[i]).attr("active"))
    .attr("r", zoomOrKeep(ACTIVE_RADIUS));

  document.getElementById("zoom").innerHTML = zoomLevel.toFixed(2);
};

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
    case "fileOpen":
      let path = message.payload.path;
      if (path.endsWith(".git")) {
        path = path.slice(0, -4);
      }

      const fixSlashes = (input) => {
        const onLocalWindowsFilesystem =
          navigator.platform == "Win32" && /^\w:\\/.test(input);
        return onLocalWindowsFilesystem ? input.replace(/\//g, "\\") : input;
      };

      node.attr("active", (d) => (fixSlashes(d.path) === path ? true : null));
      text.attr("active", (d) => (fixSlashes(d.path) === path ? true : null));
      break;
  }

  // Resize to update size of active node.
  resize();
});

const ticked = () => {
  document.getElementById("connections").innerHTML = linksData.length;
  document.getElementById("files").innerHTML = nodesData.length;

  node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
  text.attr("x", (d) => d.x).attr("y", (d) => d.y - FONT_BASELINE / zoomLevel);
  link
    .attr("x1", (d) => d.source.x)
    .attr("y1", (d) => d.source.y)
    .attr("x2", (d) => d.target.x)
    .attr("y2", (d) => d.target.y);
};

const restart = () => {
  node = node.data(nodesData, (d) => d.id);
  node.exit().remove();
  node = node
    .enter()
    .append("circle")
    .attr("r", RADIUS)
    .on("click", onClick)
    .merge(node);

  link = link.data(linksData, (d) => `${d.source.id}-${d.target.id}`);
  link.exit().remove();
  link = link.enter().append("line").attr("stroke-width", STROKE).merge(link);

  text = text.data(nodesData, (d) => d.label);
  text.exit().remove();
  text = text
    .enter()
    .append("text")
    .text((d) => d.label.replace(/_*/g, ""))
    .attr("font-size", `${FONT_SIZE}px`)
    .attr("text-anchor", "middle")
    .attr("alignment-baseline", "central")
    .on("click", onClick)
    .merge(text);

  simulation.nodes(nodesData);
  simulation.force("link").links(linksData);
  simulation.alpha(1).restart();
  simulation.stop();

  for (let i = 0; i < TICKS; i++) {
    simulation.tick();
  }

  ticked();
};

const zoomHandler = d3.zoom().scaleExtent([0.2, 3]).on("zoom", resize);

zoomHandler(svg);
restart();

vscode.postMessage({ type: "ready" });
