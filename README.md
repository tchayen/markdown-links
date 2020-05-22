# Markdown Links

Adds command `Show Graph` that displays a graph of local links between markdown files in the current working directory.

![Demo GIF](demo.gif)

## Workflow

Recommended workflow is either keeping the graph open and using it as an alternative to the explorer sidebar or checking the it from time to time.

The graph refreshes automatically every time you:

- Update a markdown title of the file.
- Change links to other files.
- Create a new file and add give it a title.
- Remove a file.

## Concepts

- Title is always the first markdown heading of depth 1, i.e. `# Title`.
- Any link or reference to a local file causes the extension to attempt parsing it. The title is required but links are optional (it results in a lone node with no edges in such case).
- Graph is not directed. It doesn't show which file has the link and which one is linked.
- Directory structure is not relevant for the graph. All that matters is the mutual links between files.

## Examples

Here are some examples to better explain the above.

### Basic file

```md
# Title

Link can be present in [text](first.md) or on a special list.

## Linked

- [Second](./2.md)

Named reference can also be used, like this: [Reference].

[reference]: ref.md
```

### More

You can open any example in the `examples` directory and try yourself by pressing `SHIFT+CMD+P` (or `SHIFT+CTRL+P`) and selecting `Show Graph`.

## Settings

This extension contributes the following settings:

### `markdown-links.showColumn`

Controls in which column should the graph appear. Refer to [Column values](###column-values). Defaults to `beside`.

### `markdown-links.openColumn`

Controls in which column should clicked files open. Refer to [Column values](###column-values). Defaults to `one`.

### Column values

- `active` – in the currently focused column.
- `beside` – other than the current.
- `one` (**default**), `two`, `three`, `four`, `five`, `six`, `seven`, `eight`, `nine` – respective editor columns.

## Roadmap

This is early development version. I am currently considering:

- [x] Main `Show Graph` command.
- [x] Setting for choosing column for opening files.
- [ ] Automated tests.
- [ ] Dark theme support (+ auto detecting system's dark/light mode).
- [ ] Zoom controls (`+` / `-` / `reset`).
- [ ] Handling external URLs.
- [ ] Ignoring files or directories.
- [ ] Some directory controls within the graph view (adding, removing files).
- [ ] Configurable simulation.
- [ ] Optional display of edge directions.
- [ ] Better examples.
- [ ] Optional autostart.

## Changelog

Refer to the [CHANGELOG.md](CHANGELOG.md) file.

## Contributing

You are very welcome to open an issue or a pull request with changes.

If it is your first time with vscode extension, make sure to checkout [Official Guides](https://code.visualstudio.com/api/get-started/your-first-extension).
