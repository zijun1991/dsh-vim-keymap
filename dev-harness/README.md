# dev-harness

Manual real-browser verification only — **not part of the published plugin**
(`package.json`'s `files` field ships only `lib/`). jsdom has no layout engine
at all (see `tests/spike-codemirror-vim-headless.test.ts`), so anything that
depends on real cursor measurement, real focus/keydown timing, or real
`getBoundingClientRect` positioning can only be checked here.

This page mirrors the two real DOM shapes the bridge integrates with —
`[data-composer-card] textarea` and a `role="tree"`/`role="treeitem"`/
`aria-expanded` tree — and mounts the actual built `lib/` output (not a
reimplementation) directly: `ModeMachine`, `CodeMirrorVimEngine`,
`attachTextareaAdapter`, `createRootOverlay`. The fold/expand mock in
`main.ts` and the tree markup are the only harness-only code; everything else
is the real production bridge.

```sh
pnpm run build   # emit lib/ first — the harness imports it, not src/
pnpm run dev:harness
```

Mounting into an actual running `dsh --profile web` instance is a separate,
unfinished piece of work — see README.md's "Known limitations" for why.
