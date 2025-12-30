import * as assert from "assert";
import { suite, test } from "mocha";
import { resolveLinkPath, idResolver } from "../../parsing";
import * as path from "path";

suite("Parsing Test Suite", () => {
  suite("idResolver", () => {
    test("should return id if not found in mapping", () => {
      const result = idResolver("unknown-id");
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0], "unknown-id");
    });
  });

  suite("resolveLinkPath", () => {
    const workspaceRoot = "/Users/test/workspace";
    const currentFileDir = "/Users/test/workspace/docs/guides";

    test("should resolve relative path with ./", () => {
      const result = resolveLinkPath(
        "./example.md",
        currentFileDir,
        workspaceRoot,
      );
      assert.strictEqual(result, path.join(currentFileDir, "example.md"));
    });

    test("should resolve relative path with ../", () => {
      const result = resolveLinkPath(
        "../other.md",
        currentFileDir,
        workspaceRoot,
      );
      assert.strictEqual(result, path.join(currentFileDir, "..", "other.md"));
    });

    test("should resolve workspace-relative path (issue #48)", () => {
      const result = resolveLinkPath(
        "/docs/file.md",
        currentFileDir,
        workspaceRoot,
      );
      assert.strictEqual(result, path.join(workspaceRoot, "docs/file.md"));
    });

    test("should return null for workspace-relative path without workspace root", () => {
      const result = resolveLinkPath(
        "/docs/file.md",
        currentFileDir,
        undefined,
      );
      assert.strictEqual(result, null);
    });

    test("should treat paths starting with / as workspace-relative (issue #48)", () => {
      // Paths starting with / are treated as workspace-relative by convention
      // This matches markdown behavior where /docs/file.md means "from workspace root"
      // Note: This means true filesystem absolute paths on Unix can't be used in links,
      // but that's intentional - markdown links should be workspace-relative
      const result = resolveLinkPath(
        "/absolute/path/to/file.md",
        currentFileDir,
        workspaceRoot,
      );
      assert.strictEqual(
        result,
        path.join(workspaceRoot, "absolute/path/to/file.md"),
      );
    });

    test("should resolve nested relative paths", () => {
      const result = resolveLinkPath(
        "../../root.md",
        currentFileDir,
        workspaceRoot,
      );
      assert.strictEqual(
        result,
        path.join(currentFileDir, "..", "..", "root.md"),
      );
    });

    test("should resolve relative path without ./", () => {
      const result = resolveLinkPath(
        "sibling.md",
        currentFileDir,
        workspaceRoot,
      );
      assert.strictEqual(result, path.join(currentFileDir, "sibling.md"));
    });
  });
});
