import * as assert from "assert";
import { suite, test, before } from "mocha";
import * as vscode from "vscode";

suite("Extension Integration Test Suite", () => {
  before(() => {
    vscode.window.showInformationMessage("Starting integration tests.");
  });

  test("Extension should be present", () => {
    assert.ok(vscode.extensions.getExtension("tchayen.markdown-links"));
  });

  test("Extension should activate", async () => {
    const ext = vscode.extensions.getExtension("tchayen.markdown-links");
    assert.ok(ext);
    await ext?.activate();
    assert.strictEqual(ext?.isActive, true);
  });

  test("Command should be registered", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes("markdown-links.showGraph"));
  });

  test("Configuration should have default values", () => {
    const config = vscode.workspace.getConfiguration("markdown-links");
    assert.strictEqual(config.get("showColumn"), "beside");
    assert.strictEqual(config.get("openColumn"), "one");
    assert.strictEqual(config.get("fileIdRegexp"), "\\d{14}");
    assert.strictEqual(config.get("autoStart"), false);
    assert.strictEqual(config.get("graphType"), "default");
    assert.strictEqual(config.get("titleMaxLength"), 24);
  });
});
