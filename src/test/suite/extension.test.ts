import * as assert from "assert";

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode";
import * as ast from "./ast.json";
import { findLinks, findTitle, id } from "../../utils";
// import * as myExtension from '../../extension';

suite("Tests", () => {
  vscode.window.showInformationMessage("Start all tests.");

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
      id("/Users/example/Desktop/notes/1.md"),
      "daea8e534ce10d7a2e16635f182c29b8"
    );
  });
});
