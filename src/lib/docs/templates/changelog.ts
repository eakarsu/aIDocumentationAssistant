export const changelogTemplate = {
  name: 'Changelog',
  description: 'Version-based release notes following Keep a Changelog format',
  type: 'CHANGELOG',
  content: `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- New feature that was added

### Changed
- Existing functionality that was changed

### Deprecated
- Features that will be removed in future versions

### Removed
- Features that were removed

### Fixed
- Bug fixes

### Security
- Security-related changes

---

## [1.0.0] - YYYY-MM-DD

### Added
- Initial release
- Core functionality
- Basic documentation

### Changed
- N/A (initial release)

---

## [0.2.0] - YYYY-MM-DD

### Added
- New feature A
- New feature B

### Fixed
- Bug in feature X
- Performance issue in module Y

---

## [0.1.0] - YYYY-MM-DD

### Added
- Alpha release
- Basic structure

---

[Unreleased]: https://github.com/owner/repo/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/owner/repo/compare/v0.2.0...v1.0.0
[0.2.0]: https://github.com/owner/repo/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/owner/repo/releases/tag/v0.1.0
`,
  isSystem: true,
};
