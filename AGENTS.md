# AGENTS: OpenCode PM
Build/Lint/Test
- Backend: `cargo build --all`; dev: `make dev`
- Lint/format: `make check` or `cargo fmt --all && cargo clippy --all-targets --all-features -D warnings`
- Tests: `cargo test --all`; single: `cargo test -p <crate> <module>::<name> -- --exact --nocapture`
- Frontend: `pnpm dev|build|lint`; Tauri: `cd tauri-app && pnpm tauri dev`
- Toolchain: pinned via `rust-toolchain.toml` (rustfmt, clippy)
Rust Style
- Imports: group std, external, local; sort within groups
- Types: derive `Debug, Clone, Serialize, Deserialize`; prefer explicit types
- Naming: snake_case (fns/vars/modules), PascalCase (types), SCREAMING_SNAKE_CASE (consts)
- Errors: domain via `thiserror`; `anyhow::Result<T>` + `?` + `Context`; avoid `unwrap/expect` outside tests
- Async/Tests: `tokio` runtime; `#[tokio::test]`; log with `tracing`/`#[instrument]`
JavaScript/React
- Components: functional + hooks; strict types (TS in Tauri); avoid `any`
- Imports: external before local; alphabetize; naming: camelCase (vars/fns), PascalCase (components), SCREAMING_SNAKE_CASE (env)
- Errors: use async/await + try/catch; no silent failures
- Linting/Styles: `eslint` per `eslint.config.js`; Tailwind; minimize inline styles
Cursor/Copilot
- No `.cursor/` rules or Copilot instructions found
