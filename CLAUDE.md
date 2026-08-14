# dsh-vim-keymap

Vim keybindings for the deepseek-harness Web GUI, mounted as an out-of-tree Cordis plugin. It depends only on published `@deepseek-ai/dsh-client-*` packages and never modifies deepseek-harness itself — see the design notes in `README.md`.

## Repository conventions

- **No AI attribution in this repository.** Commits in this repo must not carry a `Co-Authored-By: Claude` (or any other AI tool) trailer. No file other than this `CLAUDE.md` may reference Claude, Anthropic, or other AI-assistant tooling — any local AI-assistant configuration (e.g. `.claude/`) stays gitignored and is never staged or pushed.
- Standard TypeScript strict mode; no `any` without a documented reason.
- Bridges to the host UI (input box, workspace tree) must not depend on any deepseek-harness-internal API that isn't part of its public package exports or public DOM/ARIA structure — this plugin ships and evolves independently of deepseek-harness.
