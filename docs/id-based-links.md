# ID-based links

A file can be given an ID that can be used to link it from other files. The ID is a first string matching a configured pattern (see [Settings](#settings)) found in the file.

File having an ID can be linked using double-bracketed 'wiki-style' links. For example:

```md
<!-- file1.md -->

# This is a file having an id

This is its id: 20200522225822
```

```md
<!-- file2.md -->

# This is a file linking to another

See the other file: [[20200522225822]]
```

This feature is heavily inspired by [Zettlr](https://github.com/Zettlr/Zettlr), therefore its [documentation](https://docs.zettlr.com/en/reference/settings/#the-id-regex) may give useful background.

#### Using title as the ID

By setting the ID regexp setting to `(?<=^# ).+$` all titles (level 1 # headings) will be detected as IDs. This allows you to do the following:

```md
<!-- file1.md -->

# This file just has a title

And some content.
```

```md
<!-- file2.md -->

# This is a file linking to another

See the other file: [[This file just has a title]]
```

You'll have to **restart VS Code** for the changed setting to take effect.
