# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] – 2020-05-23

### Changed

- When active file in the editor changes, it will be highlighted on the graph if it matches one of the nodes.

## [0.4.0] - 2020-05-23

### Added

- Support for wiki-style links using `[[link]]` format and corresponding `fileIdRegexp` setting for specifying regular expression for resolving file IDs – [d3254f68](https://github.com/tchayen/markdown-links/commit/d3254f687c4cc0a9b11f218dddc5069bb4898cbe).

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
