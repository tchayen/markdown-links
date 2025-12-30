import * as assert from "assert";
import { suite, test } from "mocha";
import {
  findLinks,
  findTitle,
  id,
  exists,
  filterNonExistingEdges,
  getDot,
} from "../../utils";
import { MarkdownNode, Graph } from "../../types";

suite("Utils Test Suite", () => {
  suite("findLinks", () => {
    test("should find markdown links", () => {
      const ast: MarkdownNode = {
        type: "link",
        url: "./test.md",
        children: [],
      };
      const links = findLinks(ast);
      assert.strictEqual(links.length, 1);
      assert.strictEqual(links[0], "./test.md");
    });

    test("should handle parent directory relative paths (issue #98)", () => {
      const ast: MarkdownNode = {
        type: "link",
        url: "../parent.md",
        children: [],
      };
      const links = findLinks(ast);
      assert.strictEqual(links.length, 1);
      assert.strictEqual(links[0], "../parent.md");
    });

    test("should ignore empty links", () => {
      const ast: MarkdownNode = {
        type: "link",
        url: "",
        children: [],
      };
      const links = findLinks(ast);
      assert.strictEqual(links.length, 0);
    });

    test("should ignore anchor links", () => {
      const ast: MarkdownNode = {
        type: "link",
        url: "#section",
        children: [],
      };
      const links = findLinks(ast);
      assert.strictEqual(links.length, 0);
    });

    test("should ignore http links", () => {
      const ast: MarkdownNode = {
        type: "link",
        url: "https://example.com",
        children: [],
      };
      const links = findLinks(ast);
      assert.strictEqual(links.length, 0);
    });

    test("should find wiki links", () => {
      const ast: MarkdownNode = {
        type: "wikiLink",
        data: {
          permalink: "test-page",
        },
        children: [],
      };
      const links = findLinks(ast);
      assert.strictEqual(links.length, 1);
      assert.strictEqual(links[0], "test-page");
    });

    test("should recursively find links in children", () => {
      const ast: MarkdownNode = {
        type: "root",
        children: [
          {
            type: "paragraph",
            children: [
              {
                type: "link",
                url: "./first.md",
                children: [],
              },
            ],
          },
          {
            type: "paragraph",
            children: [
              {
                type: "link",
                url: "./second.md",
                children: [],
              },
            ],
          },
        ],
      };
      const links = findLinks(ast);
      assert.strictEqual(links.length, 2);
      assert.strictEqual(links[0], "./first.md");
      assert.strictEqual(links[1], "./second.md");
    });

    test("should handle malformed links with nested markdown syntax gracefully", () => {
      // This represents a malformed link like:
      // [text](<[https://url](https://url)>)
      const ast: MarkdownNode = {
        type: "link",
        url: "<[https://cloudinary.com/users/register/free](https://cloudinary.com/users/register/free%5C)>",
        children: [],
      };
      // Should not throw an error and should ignore this malformed link (HTTP)
      const links = findLinks(ast);
      assert.strictEqual(links.length, 0);
    });

    test("should extract URL from double parenthesis with local link (issue #45)", () => {
      // Pattern: [text]((path/to/file.md)) - should extract the actual path
      const ast: MarkdownNode = {
        type: "link",
        url: "(./test.md)",
        children: [],
      };
      const links = findLinks(ast);
      assert.strictEqual(links.length, 1);
      assert.strictEqual(links[0], "./test.md");
    });

    test("should extract URL from nested parenthesis with angle brackets (issue #45)", () => {
      // Pattern: [text](<(link)>) - should extract the actual link
      const ast: MarkdownNode = {
        type: "link",
        url: "<(./notes/file.md)>",
        children: [],
      };
      const links = findLinks(ast);
      assert.strictEqual(links.length, 1);
      assert.strictEqual(links[0], "./notes/file.md");
    });

    test("should handle double parenthesis with HTTP URL (issue #45)", () => {
      // Pattern: [text]((https://url)) causes [UriError] but is HTTP so should be ignored
      const ast: MarkdownNode = {
        type: "link",
        url: "(https://www.quantamagazine.org/article/)",
        children: [],
      };
      // Should not throw an error and should ignore HTTP links
      const links = findLinks(ast);
      assert.strictEqual(links.length, 0);
    });

    test("should handle simple malformed colon pattern (issue #45)", () => {
      // Pattern: ]((:)) minimal reproduction case - unparsable
      const ast: MarkdownNode = {
        type: "link",
        url: "(:)",
        children: [],
      };
      // Should not throw an error, but this is too malformed to extract
      const links = findLinks(ast);
      assert.strictEqual(links.length, 0);
    });
  });

  suite("findTitle", () => {
    test("should find h1 title", () => {
      const ast: MarkdownNode = {
        type: "root",
        children: [
          {
            type: "heading",
            depth: 1,
            children: [
              {
                type: "text",
                value: "Test Title",
              },
            ],
          },
        ],
      };
      const title = findTitle(ast);
      assert.strictEqual(title, "Test Title");
    });

    test("should prefer frontmatter title over h1", () => {
      const ast: MarkdownNode = {
        type: "root",
        children: [
          {
            type: "yaml",
            value: "title: Frontmatter Title\nid: 123",
          },
          {
            type: "heading",
            depth: 1,
            children: [
              {
                type: "text",
                value: "H1 Title",
              },
            ],
          },
        ],
      };
      const title = findTitle(ast);
      assert.strictEqual(title, "Frontmatter Title");
    });

    test("should handle frontmatter title with quotes", () => {
      const ast: MarkdownNode = {
        type: "root",
        children: [
          {
            type: "yaml",
            value: 'title: "Quoted Title"',
          },
        ],
      };
      const title = findTitle(ast);
      assert.strictEqual(title, "Quoted Title");
    });

    test("should handle frontmatter title with single quotes", () => {
      const ast: MarkdownNode = {
        type: "root",
        children: [
          {
            type: "yaml",
            value: "title: 'Single Quoted Title'",
          },
        ],
      };
      const title = findTitle(ast);
      assert.strictEqual(title, "Single Quoted Title");
    });

    test("should fallback to h1 if frontmatter has no title", () => {
      const ast: MarkdownNode = {
        type: "root",
        children: [
          {
            type: "yaml",
            value: "id: 123\nauthor: John",
          },
          {
            type: "heading",
            depth: 1,
            children: [
              {
                type: "text",
                value: "H1 Title",
              },
            ],
          },
        ],
      };
      const title = findTitle(ast);
      assert.strictEqual(title, "H1 Title");
    });

    test("should handle invalid frontmatter YAML gracefully", () => {
      const ast: MarkdownNode = {
        type: "root",
        children: [
          {
            type: "yaml",
            value: "invalid: yaml: content: [[[",
          },
          {
            type: "heading",
            depth: 1,
            children: [
              {
                type: "text",
                value: "H1 Title",
              },
            ],
          },
        ],
      };
      const title = findTitle(ast);
      assert.strictEqual(title, "H1 Title");
    });

    test("should return null if no h1 found", () => {
      const ast: MarkdownNode = {
        type: "root",
        children: [
          {
            type: "heading",
            depth: 2,
            children: [
              {
                type: "text",
                value: "Test Title",
              },
            ],
          },
        ],
      };
      const title = findTitle(ast);
      assert.strictEqual(title, null);
    });

    test("should return null if no children", () => {
      const ast: MarkdownNode = {
        type: "root",
        children: [],
      };
      const title = findTitle(ast);
      assert.strictEqual(title, null);
    });

    test("should return empty string if h1 has no text", () => {
      const ast: MarkdownNode = {
        type: "root",
        children: [
          {
            type: "heading",
            depth: 1,
            children: [
              {
                type: "text",
                value: "",
              },
            ],
          },
        ],
      };
      const title = findTitle(ast);
      assert.strictEqual(title, "");
    });
  });

  suite("id", () => {
    test("should generate consistent id for same path", () => {
      const path = "/path/to/file.md";
      const id1 = id(path);
      const id2 = id(path);
      assert.strictEqual(id1, id2);
    });

    test("should generate different ids for different paths", () => {
      const path1 = "/path/to/file1.md";
      const path2 = "/path/to/file2.md";
      const id1 = id(path1);
      const id2 = id(path2);
      assert.notStrictEqual(id1, id2);
    });

    test("should ignore file extension", () => {
      const path1 = "/path/to/file.md";
      const path2 = "/path/to/file.txt";
      const id1 = id(path1);
      const id2 = id(path2);
      assert.strictEqual(id1, id2);
    });
  });

  suite("exists", () => {
    test("should return true if node exists", () => {
      const graph: Graph = {
        nodes: [{ id: "test-id", path: "/path/to/file.md", label: "Test" }],
        edges: [],
      };
      assert.strictEqual(exists(graph, "test-id"), true);
    });

    test("should return false if node does not exist", () => {
      const graph: Graph = {
        nodes: [{ id: "test-id", path: "/path/to/file.md", label: "Test" }],
        edges: [],
      };
      assert.strictEqual(exists(graph, "other-id"), false);
    });

    test("should return false for empty graph", () => {
      const graph: Graph = {
        nodes: [],
        edges: [],
      };
      assert.strictEqual(exists(graph, "test-id"), false);
    });
  });

  suite("filterNonExistingEdges", () => {
    test("should remove edges with non-existing source", () => {
      const graph: Graph = {
        nodes: [
          { id: "node1", path: "/path/1.md", label: "Node 1" },
          { id: "node2", path: "/path/2.md", label: "Node 2" },
        ],
        edges: [
          { source: "node1", target: "node2" },
          { source: "node3", target: "node2" },
        ],
      };
      filterNonExistingEdges(graph);
      assert.strictEqual(graph.edges.length, 1);
      assert.strictEqual(graph.edges[0]?.source, "node1");
    });

    test("should remove edges with non-existing target", () => {
      const graph: Graph = {
        nodes: [
          { id: "node1", path: "/path/1.md", label: "Node 1" },
          { id: "node2", path: "/path/2.md", label: "Node 2" },
        ],
        edges: [
          { source: "node1", target: "node2" },
          { source: "node1", target: "node3" },
        ],
      };
      filterNonExistingEdges(graph);
      assert.strictEqual(graph.edges.length, 1);
      assert.strictEqual(graph.edges[0]?.target, "node2");
    });

    test("should keep all valid edges", () => {
      const graph: Graph = {
        nodes: [
          { id: "node1", path: "/path/1.md", label: "Node 1" },
          { id: "node2", path: "/path/2.md", label: "Node 2" },
        ],
        edges: [
          { source: "node1", target: "node2" },
          { source: "node2", target: "node1" },
        ],
      };
      filterNonExistingEdges(graph);
      assert.strictEqual(graph.edges.length, 2);
    });
  });

  suite("getDot", () => {
    test("should generate DOT graph format", () => {
      const graph: Graph = {
        nodes: [
          { id: "node1", path: "/path/1.md", label: "Node 1" },
          { id: "node2", path: "/path/2.md", label: "Node 2" },
        ],
        edges: [{ source: "node1", target: "node2" }],
      };
      const dot = getDot(graph);
      assert.ok(dot.includes("digraph g"));
      assert.ok(dot.includes('node1 [label="Node 1"]'));
      assert.ok(dot.includes('node2 [label="Node 2"]'));
      assert.ok(dot.includes("node1 -> node2"));
    });

    test("should handle empty graph", () => {
      const graph: Graph = {
        nodes: [],
        edges: [],
      };
      const dot = getDot(graph);
      assert.ok(dot.includes("digraph g"));
    });
  });
});
