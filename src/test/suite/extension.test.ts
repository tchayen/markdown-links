import * as assert from "assert";

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode";
import * as ast from "./ast.json";
import {
  findLinks,
  findTitle,
  id,
  getDot,
  exists,
  filterNonExistingEdges,
} from "../../utils";

suite("Tests", () => {
  vscode.window.showInformationMessage("Start all tests.");

  const getGraph = () => ({
    nodes: [
      { id: "1", label: "First", path: "/Users/test/Desktop/notes/1.md" },
      { id: "2", label: "Second", path: "/Users/test/Desktop/notes/2.md" },
      { id: "3", label: "Third", path: "/Users/test/Desktop/notes/3.md" },
    ],
    edges: [
      { source: "1", target: "2" },
      { source: "1", target: "3" },
      { source: "3", target: "2" },
    ],
  });

  test("findLinks works", () => {
    const links = findLinks(ast);
    const expected = [
      "another.md",
      "other.md",
      "nested.md",
      "error.md",
      "more.md",
    ];

    assert.deepStrictEqual(links, expected);
  });

  test("findTitle works", () => {
    assert.equal(findTitle(ast), "Links");
  });

  test("id works", () => {
    assert.equal(
      id("/Users/test/Desktop/notes/1.md"),
      "a2c0c4c2697d0cde5f0e3888bf1d7630"
    );
  });

  test("getColumnSetting works", () => {
    // TODO: mock vscode.workspace.getConfiguration
  });

  test("getFileIdRegexp", () => {
    // TODO: mock vscode.workspace.getConfiguration
  });

  test("getDot works", () => {
    const graph = getGraph();
    const dot = getDot(graph);
    const expected =
      'digraph g {\n  1 [label="First"];\n  2 [label="Second"];\n  3 [label="Third"];\n  1 -> 2\n  1 -> 3\n  3 -> 2\n}';

    assert.equal(dot, expected);
  });

  test("exists works", () => {
    const graph = getGraph();
    assert.equal(exists(graph, "1"), true);
    assert.equal(exists(graph, "First"), false);
  });

  test("filterNonExistingEdges", () => {
    const graph = getGraph();
    graph.edges.push({ source: "2", target: "https://wikipedia.org" });
    graph.edges.push({ source: "2", target: "4" });

    assert.equal(graph.edges.length, 5);
    filterNonExistingEdges(graph);
    assert.equal(graph.edges.length, 3);
  });

  test("idResolver works", () => {});

  test("parseFile works", () => {});

  test("findFileId works", () => {});

  test("learnFileId works", () => {});

  test("parseDirectory works", () => {});
});
