import path from "path";
import { readdir } from "fs/promises";
import Mocha from "mocha";

async function* walkTestFiles(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      yield* walkTestFiles(fullPath);
    } else if (entry.name.endsWith(".test.js")) {
      yield fullPath;
    }
  }
}

export async function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: "tdd",
    color: true,
    timeout: 10000,
  });

  const testsRoot = path.resolve(__dirname, "..");

  try {
    // Find all test files
    for await (const file of walkTestFiles(testsRoot)) {
      mocha.addFile(file);
    }

    // Run the mocha test
    return new Promise((resolve, reject) => {
      try {
        mocha.run((failures) => {
          if (failures > 0) {
            reject(new Error(`${failures} tests failed.`));
          } else {
            resolve();
          }
        });
      } catch (err) {
        console.error(err);
        reject(err);
      }
    });
  } catch (err) {
    console.error("Failed to find test files:", err);
    throw err;
  }
}
