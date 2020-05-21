# Markdown Links

Adds command `Show Graph` that displays a graph of local links between markdown files in the current working directory.

![Demo GIF](demo.gif)

## Workflow

Recommended workflow is either keeping the graph open and using it as an alternative to the explorer sidebar or checking the it from time to time.

The graph refreshes automatically every time you:

- Update a markdown title of the file
- Change links to other files
- Create a new file and add give it a title
- Remove a file

Title is always the first markdown heading of depth 1, i.e. `# Title`.

Any link or reference to a local file causes the extension to attempt parsing it. The title is required but links are optional (it results in a lone node with no edges).

### Example file

```md
# Title

Link can be present in [text](first.md) or on a special list.

## Linked

- [Second](./2.md)

Named reference can also be used, like this: [Reference].

[reference]: ref.md
```

### More examples

You can open any example in the `examples` directory and try yourself by pressing `SHIFT+CMD+P` (or `SHIFT+CTRL+P`) and selecting `Show Graph`.

## Settings

This extension contributes the following settings:

### `markdown-links.column`

- `active` – in the currently focused column.
- `beside` – other than the current.
- `one` (**default**), `two`, `three`, `four`, `five`, `six`, `seven`, `eight`, `nine` – respective editor columns.

## Changelog

Refer to the [CHANGELOG.md](CHANGELOG.md) file.

## Roadmap

This is early development version. I am currently considering:

- [x] Main `Show Graph` command
- [x] Setting for choosing column for opening files
- [ ] Automated tests
- [ ] Dark theme support (+ auto detecting system's dark/light mode)
- [ ] Zoom controls (`+` / `-` / `reset`)
- [ ] Handling external URLs
- [ ] Ignoring files or directories
- [ ] Some directory controls within the graph view (adding, removing files)
- [ ] Configurable simulation
- [ ] Better examples
- [ ] Optional autostart

## Contributing

You are very welcome to open an issue or a pull request with changes.

If it is your first time with vscode extension, make sure to checkout [Official Guides](https://code.visualstudio.com/api/get-started/your-first-extension).
