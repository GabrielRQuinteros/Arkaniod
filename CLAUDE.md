# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

Early-stage Arkanoid/Breakout browser game. No game code, build system, package manager, tests, or linter exist yet. The repo currently holds only assets plus spec-workflow skills. There is no git repo (`git init` has not been run), and no `specs/` folder yet.

## Assets (`assets/`)

- `spritesheet-breakout.png`: single spritesheet for paddle, ball, blocks and explosion frames.
- `spritesheet.js`: plain-script (no modules) sprite helper. Defines globals `SPRITES`, `EXPLOSION_FRAMES`, `EXPLOSION_DURATION` (150 ms), `loadSpritesheet(cb)`, `drawSprite(ctx, name, x, y, w, h)`, `drawFrame(ctx, frame, x, y, w, h)`.
  - Block sprites are addressed as `block_<color>` (colors: gray, red, yellow, cyan, magenta, hotpink, green); `paddle` and `ball` are addressed by name.
  - `loadSpritesheet` copies the PNG onto an offscreen canvas and queues callbacks. Draw calls silently no-op until loaded, so start the game loop inside the callback.
  - The image path `assets/spritesheet-breakout.png` is relative to the HTML page, so the page must sit at the project root and be served/opened from there.
  - `EXPLOSION_FRAMES.gray` reuses the red frames (same coordinates); this appears to be a placeholder.
- `sounds/ball-bounce.mp3`, `sounds/break-sound.mp3`: SFX for paddle/wall bounce and block break.

## Spec-driven workflow

Skills in `.agents/skills/` (installed from `Klerith/fernando-skills`, pinned in `skills-lock.json`) define the workflow for features. Claude Code only loads skills from `.claude/skills/`, so copies of `spec` and `spec-impl` live there too; keep both in sync:

- `/spec <description>`: asks clarifying questions, then writes `specs/NN-slug.md` (state `Draft`). Writes no code.
- `/spec-impl <NN-slug>`: only runs on specs whose state is `Approved`; the human flips Draft to Approved. It creates branch `spec-NN-slug` (needs git; controlled by `specs/.spec-config.yml` `AutoCreateBranch`), then implements one plan step at a time, pausing for diff review. It never commits automatically.

Implement what the spec says; spec changes go into the spec, not into code by surprise.
