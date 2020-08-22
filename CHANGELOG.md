# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.8.0] – 2020-08-22

### Added

- Custom rendering modes! Starting with two choices: `default` and `obsidian` (inspired by the Obsidian editor) available under `Markdown-links: Graph Type` ([#51](https://github.com/tchayen/markdown-links/pull/51)).

### Changed

- Ignored files specified in workspace are now respected ([#35](https://github.com/tchayen/markdown-links/pull/35)).
### Fixed

- Fixed the problem with deleting and or renaming files on Windows ([#53](https://github.com/tchayen/markdown-links/pull/53)).
- Non-existing edges are now re-filtered when deleting files ([#54](https://github.com/tchayen/markdown-links/pull/54)).

## [0.7.0] – 2020-07-25

### Added

- Extensions to look for can now be specified in settings ([#31](https://github.com/tchayen/markdown-links/pull/31)).
- Configurable autostart ([#14](https://github.com/tchayen/markdown-links/pull/14)).

### Fixed

- Graph should now properly update on adding a new file ([#34](https://github.com/tchayen/markdown-links/pull/34)).
- Wrong active node size when zooming ([#20](https://github.com/tchayen/markdown-links/pull/20)).

## [0.6.0] – 2020-06-26

### Added

- Support for [file-name] ids. A format where id of a file is its name (works either with or without `.md` extension) ([#13](https://github.com/tchayen/markdown-links/pull/13)).

### Fixed

- Active node highlight should work better on Windows ([#10](https://github.com/tchayen/markdown-links/pull/10)).

### Changed

- Extension will now pick colors of your theme ([#10](https://github.com/tchayen/markdown-links/pull/10)).

## [0.5.0] – 2020-05-23

### Changed

- When active file in the editor changes, it will be highlighted on the graph if it matches one of the nodes.

## [0.4.0] - 2020-05-23

### Added

- Support for wiki-style links using `[[link]]` format and corresponding `fileIdRegexp` setting for specifying regular expression for resolving file IDs – ([#3](https://github.com/tchayen/markdown-links/pull/3)).

## [0.3.0] - 2020-05-22

### Changed

- `column` setting is now divided into `openColumn` and `showColumn`.

## [0.2.3] - 2020-05-22

### Fixed

- Graph reloads on title change.
- Parsing of files in a directory now happens asynchronously.

## [0.2.2] - 2020-05-22

### Fixed

- Fix bug with missing `d3`.

## [0.2.1] - 2020-05-21

### Fixed

- Fix bug with missing `webview.html`.

## [0.2.0] - 2020-05-21

### Changed

- Extension is now configured to use bundle.

## [0.1.0] - 2020-05-21

### Added

- Initial version of the `Show Graph` command.
- Setting for controlling the `column` used to open files.
