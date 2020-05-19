# Markdown Links

Adds command `Show Graph` that displays a graph of links between files in the current working directory.

## Example usage

Let's say you have a directory with three files:

**./one.md**

```md
# One

[Second](second.md)
```

**./2.md**

```md
# Two

[One](one.md)
[Three](three.md)
```

**./three.md**

```md
# Third one

Only text.
```

If you press `Shift+CMD+P` and type `Show Graph`, a new tab will open with the graph view.

Click on any filename to have it opened in the first column of the editor (or other if configured in settings).

## Settings

This extension contributes the following settings:

### `markdown-links.theme`

`light` (default) or `dark`.

### `markdown-links.column`

- `active` – in the currently focused column.
- `beside` – other than the current.
- `one` (default), `two`, `three`, `four`, `five`, `six`, `seven`, `eight`, `nine` – respective editor columns.

### `markdown-links.ignoreDirectories`

Accepts regular expression supported by JavaScript.

### `markdown-links.ignoreFiles`

Accepts regular expression supported by JavaScript.

## Changelog

Refer to the [CHANGELOG.md](CHANGELOG.md) file.
