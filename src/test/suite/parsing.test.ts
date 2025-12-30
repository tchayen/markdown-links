import * as assert from "assert";
import { suite, test } from "mocha";
import { idResolver } from "../../parsing";

suite("Parsing Test Suite", () => {
  suite("idResolver", () => {
    test("should return id if not found in mapping", () => {
      const result = idResolver("unknown-id");
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0], "unknown-id");
    });
  });
});
