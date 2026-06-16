# Contributing to AVS

Thank you for your interest in contributing to AVS. This document explains the process for contributing to this project and provides guidelines to keep the codebase consistent and maintainable.

## Getting Started

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/rahulc0dy/AVS-PEG.git
   cd AVS
   ```
3. **Install dependencies**:
   ```bash
   bun install
   ```
4. **Create a branch** for your work:
   ```bash
   git checkout -b feature/your-feature-name
   ```
5. **Start the dev server** to verify everything works:
   ```bash
   bun run dev
   ```

## Development Workflow

### Branching Strategy

- Create feature branches from `main`.
- Use descriptive branch names: `feature/path-editor-improvements`, `fix/sensor-ray-clipping`, `docs/update-readme`.
- Keep branches focused on a single change.

### Code Style

- **TypeScript** is required for all source files.
- **ESLint** enforces the project linting rules. Run `bun run lint` before committing.
- **Prettier** handles formatting. The configuration is in `package.json`.
- Use the `@/` path alias for all project imports (mapped to the repository root).
- Follow existing file naming conventions:
  - React components and hooks: `kebab-case.ts` / `use-kebab-case.ts`
  - Simulation classes: `kebab-case.ts`
  - Type definitions: `kebab-case.ts`
  - Workers: `*.worker.ts`

### Project Boundaries

The codebase enforces a strict separation of concerns:

| Directory     | Rules                                                                                               |
| ------------- | --------------------------------------------------------------------------------------------------- |
| `lib/`        | Pure simulation logic. **No React imports.** Classes manage their own Three.js meshes and disposal. |
| `components/` | React components and hooks. Bridges simulation logic to the UI.                                     |
| `types/`      | Shared TypeScript type definitions. No runtime logic.                                               |
| `utils/`      | Pure, stateless utility functions with no side effects.                                             |
| `services/`   | External API integrations.                                                                          |

### Documentation

- Add **JSDoc comments** to all new public functions, classes, and interfaces.
- Use comments to explain _why_, not _what_.
- Do not write meta-comments like "New feature" or "Changes here".

### Commit Messages

Write clear, concise commit messages:

```
<type>: <short summary>

<optional body explaining the reasoning>
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`.

Examples:

```
feat: add path loop toggle to PathPanel
fix: prevent sensor rays from clipping through road borders
docs: document neural network architecture in INFERENCE_RULES.md
refactor: extract traffic light phase logic into TrafficLightSystem
```

## Submitting Changes

1. **Run the linter** and fix any issues:
   ```bash
   bun run lint
   ```
2. **Run a production build** to catch type errors:
   ```bash
   bun run build
   ```
3. **Push** your branch to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
4. **Open a pull request** against `main` on the upstream repository.
5. Fill out the PR template with:
   - A reference to the related issue (if applicable).
   - A clear description of what changed and why.
   - Screenshots or recordings for UI changes.

## Adding New Features

The project follows established patterns for extending functionality. Refer to the "Adding New Features" section in [AGENTS.md](AGENTS.md) for detailed instructions on:

- Adding a new marking type
- Adding a new editor mode
- Adding a new simulation system
- Adding a new worker message type

## Reporting Bugs

Use the [Bug Report](https://github.com/rahulc0dy/AVS-PEG/issues/new?template=1_bug_report.yml) issue template. Include:

- Steps to reproduce the issue.
- Expected vs actual behaviour.
- Browser and OS information.
- Console errors or screenshots if applicable.

## Requesting Features

Use the [Feature Request](https://github.com/rahulc0dy/AVS-PEG/issues/new?template=2_feature_request.yml) issue template. Describe:

- The problem the feature would solve.
- Your proposed solution.
- Any alternatives you considered.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold its standards.
