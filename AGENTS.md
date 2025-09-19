# Agent Guidelines for OpenCode PM
Build/Lint/Test
- Build: `cargo build --all` or `make dev` (server)
- Lint/Format: `make check` or `cargo fmt --all && cargo clippy --all-targets --all-features -D warnings`
- Test: `cargo test --all`; single: `cargo test -p <crate> <module>::<name> -- --exact --nocapture`
- Frontend: `pnpm dev|build|lint`; Tauri: `cd tauri-app && pnpm tauri dev`
Rust Style
- Imports: group std, external, local; sort within groups
- Types: derive `Debug, Clone, Serialize, Deserialize`; prefer explicit types
- Naming: snake_case (fns/vars/modules), PascalCase (types), SCREAMING_SNAKE_CASE (consts)
- Errors: `thiserror` for domain; `anyhow::Result<T>` + `?` + `Context`; avoid `unwrap/expect` outside tests
- Async/Tests: `tokio` runtime; `#[tokio::test]`; log with `tracing`/`#[instrument]`
TypeScript/React
- Components: functional + hooks; strict types; avoid `any`
- Imports: external then local; alphabetize
- Naming: camelCase (vars/fns), PascalCase (components/types), SCREAMING_SNAKE_CASE (env)
- Errors: async/await with try/catch; no silent failures
- Linting/Styles: `eslint` (see `eslint.config.js`); Tailwind
Cursor/Copilot
- No `.cursor/` rules or Copilot instructions found; none to apply