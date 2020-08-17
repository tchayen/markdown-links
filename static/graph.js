const RADIUS = 4;
const ACTIVE_RADIUS = 6;
const STROKE = 1;
const FONT_SIZE = 14;
const TICKS = 5000;
const FONT_BASELINE = 15;
//const activeNodeColor = "#0050ff";
//const nodeColor = "#777";

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

// const getNodeColor = (node, active) => {
//   console.log(node, active);
//   return node.path === active ? activeNodeColor : nodeColor;
// };

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

let state = { graph: {}, currentNode: undefined };
console.log(JSON.stringify(state, null, 2));
// This is calculated from state
let d3Data = { nodes: [], edges: [] };

const simulation = d3
  .forceSimulation()
  .force("charge", d3.forceManyBody().strength(-300))
  .force(
    "link",
    d3
      .forceLink()
      .id((d) => d.id)
      .distance(70)
  )
  .force("center", d3.forceCenter(width / 2, height / 2))
  // Adjusting the alpha values speeds up the simulation at the cost of "accuracy"
  // which doesn't really matter too much as we don't show the simulation while it runs
  .alphaDecay(0.05)
  .alphaMin(0.01)
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
      state = message.payload;
      restart();
      break;
  }

  // Resize to update size of active node
  resize();
});

const ticked = () => {
  document.getElementById("connections").innerHTML = d3Data.edges.length;
  document.getElementById("files").innerHTML = d3Data.nodes.length;

  node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
  text.attr("x", (d) => d.x).attr("y", (d) => d.y - FONT_BASELINE / zoomLevel);
  link
    .attr("x1", (d) => d.source.x)
    .attr("y1", (d) => d.source.y)
    .attr("x2", (d) => d.target.x)
    .attr("y2", (d) => d.target.y);
};

const restart = () => {
  const { graph, currentNode } = state;
  simulation.stop();

  // STEP 1: Compute the new node/edge data from the new state

  d3Data.nodes = d3.values(graph);
  d3Data.edges = d3.merge(
    d3Data.nodes.map((source) => {
      return source.links.map((target) => ({
        source: source.id,
        target,
      }));
    })
  );

  // STEP 2: Bind the new data to the D3 selectors

  node = node
    .data(d3Data.nodes, (d) => d.id)
    .join((enter) =>
      enter.append("circle").attr("r", RADIUS).on("click", onClick)
    );

  link = link
    .data(d3Data.edges, (d) => [d.source, d.target])
    .join((enter) => enter.append("line").attr("stroke-width", STROKE));

  text = text
    .data(d3Data.nodes, (d) => d.label)
    .join((enter) =>
      enter
        .append("text")
        .text((d) => d.label.replace(/_*/g, ""))
        .attr("opacity", 1)
        .attr("font-size", `${FONT_SIZE}px`)
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "central")
        .on("click", onClick)
    );

  // STEP 3: Additional modifications to node data (colors, show/hide, etc)

  // Set the current node & label as "active"
  node.attr("active", (d) => (d.id === currentNode ? true : null));
  text.attr("active", (d) => (d.id === currentNode ? true : null));

  // STEP 4: Restart the simulation

  simulation.nodes(d3Data.nodes);
  simulation.force("link").links(d3Data.edges);
  simulation.alpha(1).restart();
  simulation.stop();

  for (let i = 0; i < TICKS; i++) {
    simulation.tick();
  }

  ticked();
};

const zoomHandler = d3
  .zoom()
  .scaleExtent([0.2, 3])
  //.translateExtent([[0,0], [width, height]])
  //.extent([[0, 0], [width, height]])
  .on("zoom", resize);

zoomHandler(svg);

vscode.postMessage({ type: "ready" });
