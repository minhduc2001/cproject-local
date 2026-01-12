# Change Log

All notable changes to the "cproject-local" extension will be documented in this file.

## [0.2.0] - 2026-01-12

### Added

- **Docker Support**: Full support for Docker Compose projects

  - Auto-detect `docker-compose*.yml` and `docker-compose*.yaml` files
  - Support for multiple compose files in the same directory (dev, prod, test, etc.)
  - Each compose file is organized as a separate group with its own commands
  - Common docker-compose commands: `up`, `up -d`, `down`, `ps`, `logs`, `restart`, `stop`, `start`, `build`, `pull`

- **Custom Config Location**: Choose where to save `.cproject.json`

  - New setting: `cproject-local.configPath`
  - Options: Workspace root (default), custom folder, or home directory (`~/.cproject`)
  - New command: "CProject: Change Config Save Location"
  - Prevents committing config to repository

- **Config Location Display**:

  - Shows current config file location at the top of the tree view
  - Click to reveal file in OS explorer
  - Right-click for quick config path change

- **Project Organization by Type**:

  - Projects now grouped into categories: Node.js and Docker
  - Categories only show when projects exist
  - Cleaner organization for mixed-type workspaces

- **Running Status Indicators**:

  - Visual indicators at all levels (Category, Project, Compose File)
  - Shows count of running scripts even when collapsed
  - Different icons for running items (play icon with green color)
  - Example: `📦 Docker (2 projects • ▶ 5 running)`

- **Enhanced Search**: Full support for Docker commands in search
  - Search shows compose file labels (e.g., `dev: up`, `prod: down`)
  - Filter by project type, compose file, or command name

### Changed

- **Icons**: All toolbar commands now use icons instead of text for cleaner UI

  - Detect: `$(sync)` icon
  - Detect All: `$(sync-ignored)` icon
  - Refresh: `$(refresh)` icon
  - Search: `$(search)` icon
  - Change Config Path: `$(folder)` icon

- **Docker Project Names**: Include parent directory for better context

  - Example: `backend/api` instead of just `api`
  - Helps distinguish projects with similar names

- **Project Structure**:
  - Docker projects always show compose files as sub-folders
  - Better organization for projects with multiple compose files
  - Consistent structure across all project types

### Improved

- Unique terminal keys for Docker commands (includes compose file label)
- Better tooltip information showing full docker-compose commands
- More accurate running status tracking per compose file
- Enhanced visual feedback with themed icons and colors

### Fixed

- Running status now correctly tracks multiple compose files
- No more confusion when same command runs on different compose files
- Better detection of package managers (npm, yarn, pnpm, bun)

## [0.1.2] - Previous Release

- Bug fixes and improvements

## [0.1.1] - Previous Release

- Bug fixes and improvements

## [0.1.0] - Previous Release

- Bug fixes and improvements

## [0.0.1] - Initial Release

- Initial release with basic Node.js project management
- Auto-detect package.json files
- Run npm/yarn/pnpm/bun scripts from tree view
- Manual project management
- Blacklist/whitelist functionality
