# Contributing to Maestro CLI

Thank you for your interest in contributing to the Maestro CLI! This guide will help you get started.

## Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-org/agent-maestro.git
   cd agent-maestro/maestro-cli
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the project:**
   ```bash
   npm run build
   ```

4. **Link for local development:**
   ```bash
   npm link
   ```

## Running Tests

```bash
# Run all tests
npx vitest run

# Run tests in watch mode
npx vitest

# Update snapshots after intentional prompt changes
npx vitest run --update
```

## Code Style

- **TypeScript strict mode** is enabled — all code must pass `tsc --noEmit`
- **ESLint** enforces code quality rules — run `npm run lint` before committing
- **Prettier** handles formatting — run `npm run format` to auto-format
- Avoid using `any` types; prefer typed interfaces (see `src/types/`)
- Use ESM imports with `.js` extensions (required for Node.js ESM)

## Adding New Commands

1. Create a new file in `src/commands/` (e.g., `my-command.ts`)
2. Export a `registerMyCommands(program: Command)` function
3. Register it in `src/index.ts`
4. Add command IDs to `src/prompting/command-catalog.ts`
5. Add tests in `tests/commands/`

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with clear, focused commits
3. Ensure all tests pass: `npx vitest run`
4. Ensure TypeScript compiles: `npm run build`
5. Run the linter: `npm run lint`
6. Open a PR with a clear description of the changes

## Project Structure

```
maestro-cli/
├── bin/              # CLI entry point
├── src/
│   ├── commands/     # Command implementations
│   ├── prompting/    # Agent prompt composition
│   ├── prompts/      # Prompt string constants
│   ├── services/     # Business logic services
│   ├── types/        # TypeScript type definitions
│   ├── schemas/      # JSON Schema validation
│   ├── utils/        # Utilities (errors, formatting, validation)
│   ├── ui/           # Terminal display
│   ├── index.ts      # Main CLI registration
│   ├── api.ts        # HTTP API client
│   ├── config.ts     # Configuration & env vars
│   └── storage.ts    # Local storage layer
├── tests/            # Test files (mirrors src/ structure)
├── plugins/          # Built-in skill plugins
└── docs/             # Additional documentation
```

## License

By contributing, you agree that your contributions will be licensed under the AGPL-3.0-only license.
