# Markdown Links

Adds command `Show Graph` that displays a graph of local links between markdown files in the current working directory.

![Demo GIF](demo.gif)

The graph refreshes automatically every time you:

- Update a markdown title of the file
- Change links to other files
- Create a new file and add give it a title
- Remove a file

Recommended workflow is either keeping the graph open and using it as an alternative to the explorer sidebar or checking the it from time to time.

## Examples

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
