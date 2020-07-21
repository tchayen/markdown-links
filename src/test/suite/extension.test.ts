import * as assert from "assert";
import * as sinon from "sinon";
import * as path from "path";
// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode";

import * as unified from "unified";
import * as markdown from "remark-parse";

import * as ast from "./ast.json";
import {
  findLinks,
  findTitle,
  id,
  getDot,
  exists,
  filterNonExistingEdges,
  getColumnSetting,
  getFileIdRegexp,
} from "../../utils";
import { Graph } from "../../types";
import {
  parseFile,
  findFileId,
  parseDirectory,
  processFile,
  readFile
} from "../../parsing";
import { TextEncoder } from "util";

const testFolder = (file) => {
  let dir = __dirname;
  return path.join(dir + "/../../../src/test/data/" + file);
};
describe("Tests", () => {
  let stub;

  before(() => {
    stub = sinon.stub(vscode.workspace, "getConfiguration").returns({
      openColumn: "one",
      fileIdRegexp: "\\d{10}",
    } as any);
  });

  after(() => {
    stub.reset();
  });

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

  const parser = unified().use(markdown);

  it("findLinks works", () => {
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

  describe("findTitle", () => {
    it("works", () => {
      assert.equal(findTitle(ast), "Links");
    });

    it("selects correct title out of many", () => {
      assert.equal(findTitle(parser.parse("# First\n\n# Second")), "First");
    });

    it("does not find title if none exists", () => {
      assert.equal(findTitle(parser.parse("No title\n\nAnywhere here.")), null);
    });
  });

  it("id works", () => {
    assert.equal(
      id("./src/test/data/1.md"),
      "1"
    );
  });

  it("getColumnSetting works", () => {
    const setting = getColumnSetting("openColumn");
    assert.equal(setting, vscode.ViewColumn.One);
  });

  describe("getFileIdRegexp", () => {
    it("works", () => {
      const regexp = getFileIdRegexp();

      assert.equal(
        regexp.test("# Title\n\n1234567890\n\nThat was an ID."),
        true
      );

      assert.equal(regexp.test("# Title\n\n123456\n\nThat was an ID."), false);
    });

    xit("defaults if no regexp is set", () => {});
  });

  it("getDot works", () => {
    const graph = getGraph();
    const dot = getDot(graph);
    const expected =
      'digraph g {\n  1 [label="First"];\n  2 [label="Second"];\n  3 [label="Third"];\n  1 -> 2\n  1 -> 3\n  3 -> 2\n}';

    assert.equal(dot, expected);
  });

  it("exists works", () => {
    const graph = getGraph();
    assert.equal(exists(graph, "1"), true);
    assert.equal(exists(graph, "First"), false);
  });

  it("filterNonExistingEdges", () => {
    const graph = getGraph();
    graph.edges.push({ source: "2", target: "https://wikipedia.org/" });
    graph.edges.push({ source: "2", target: "4" });

    assert.equal(graph.edges.length, 5);
    filterNonExistingEdges(graph);
    assert.equal(graph.edges.length, 3);
  });

  xit("idResolver works", () => {});

  describe("parseFile", () => {
    it("readFile reads content", async () => {
      const graph: Graph = {
        nodes: [],
        edges: [],
      };
      const content = await readFile(testFolder("1.md"));
      assert.equal(content, "# Test");
    });

    it("works", () => {
      const graph: Graph = {
        nodes: [],
        edges: [],
      };

      const path = "/Users/test/Desktop/notes";
      const firstFileName = "1.md";
      const firstFilePath = `${path}/${firstFileName}`;
      const secondFileName = "2.md";
      const title = "Test";
      const content = `# ${title}\n\n[Link](${secondFileName})\n`;

      parseFile(graph, firstFilePath, content);

      assert.deepStrictEqual(graph.nodes, [
        { id: id(firstFilePath), label: title, path: firstFilePath },
      ]);
      assert.deepStrictEqual(graph.edges, [
        { source: id(firstFilePath), target: id(`${path}/${secondFileName}`) },
      ]);
    });
  });

  it("findFileId works", async () => {
    const file = "# Title\n\n1234567890\n\nThat was an ID.";

    const promise: Promise<Uint8Array> = new Promise((resolve) =>
      resolve(new TextEncoder().encode(file))
    );

    const stub = sinon.stub(vscode.workspace.fs, "readFile").returns(promise);

    assert.equal(
      await findFileId("/Users/test/Desktop/notes/1.md"),
      "1234567890"
    );

    stub.reset();
  });

  xit("learnFileId works", () => {
    // TODO: mocks.
  });

  describe("parseDirectory", () => {
    xit("works", async () => {
      const promise: Promise<[string, vscode.FileType][]> = new Promise(
        (resolve) =>
          resolve([
            ["/Users/test/Desktop/notes/1.md", vscode.FileType.File],
            ["/Users/test/Desktop/notes/2.md", vscode.FileType.File],
          ])
      );

      const stub = sinon
        .stub(vscode.workspace.fs, "readDirectory")
        .returns(promise);

      const graph = {
        nodes: [],
        edges: [],
      };

      // TODO:
      // - mock readFile to give proper content
      // - assert to make check if parseDirectory populates the graph

      await parseDirectory(graph, "/Users/test/Desktop/notes", processFile);

      stub.reset();
    });

    xit("returns empty graph for non-existing directory", async () => {});

    xit("", async () => {});
  });
});
