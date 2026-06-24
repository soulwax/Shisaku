---
title: 'Devlog #3 — Moddable From the Get-Go'
description: 'What EchoWarrior taught me about treating moddability as a structural constraint from the first commit.'
pubDate: '2026-06-25'
status: 'published'
tags:
  - rust
  - modding
  - lua
  - gamedev
---

**Versions covered:** First commit → v0.10.4 (retrospective)

---

## The Hypothesis

Most games become moddable as an afterthought. The developer builds a game, ships it, and *then* someone builds a modding toolkit, or the community reverse-engineers the format, or the developer does a belated "mod support" patch that exposes 30% of what modders actually need. The game was not *designed* to be taken apart — it was designed to be played, and the ability to reshape it is grudgingly bolted on later.

I wanted to test the opposite hypothesis: what happens if you design for moddability from the *first commit*?

Not "we'll add mod support in v1.2." Not "the architecture is clean enough that someone *could* mod it." But: every decision, from the directory layout to the serde deserialization strategy to the Lua sandbox design, is made with the question "can a modder change this without reading any Rust?"

EchoWarrior is that experiment. This is what I learned.

---

## The First Lie We Tell Ourselves

The first lie is: "I'll make it work first, then make it moddable."

I have written this lie in comments in probably a dozen abandoned prototypes. The truth is: *moddability is a structural constraint, not a feature you add*. If you do not design for it from the start, your code will develop assumptions that are painful to unpick — hardcoded enum variants, match statements that need updating for every new enemy, loading code that assumes a fixed set of assets, error handling that panics on unexpected input.

By the time you have 10,000 lines of Rust that assume enemies are defined in a match arm, the cost of extracting that into a data file is not just a refactor — it is a rewrite. And you will not do the rewrite. You will ship the game with hardcoded enemies, and modders will hex-edit the binary or give up.

I learned this the hard way on earlier projects, so for EchoWarrior I committed to a rule from day zero: **no gameplay value is hardcoded**. Not the player's movement speed, not the enemy spawn rate, not the XP required to level, not the colour of the UI, not the labels on buttons, not the dialogue text. Every single number and string lives in `Assets/Data/*.toml`.

This rule broke constantly in the first week. I would hardcode a value to get something on screen, then immediately extract it into a TOML file before moving to the next task. The first few commits show this rhythm clearly: hardcode → extract → hardcode → extract. After about day four, the pattern internalised and I stopped needing the hardcode step. I just started writing the TOML file first and the Rust loader second.

---

## Rust-Specific Roadblocks

### The Compile-Time Tax

Rust is not a fast-iterate language. On my machine, a full debug rebuild of the EchoWarrior crate takes about 12 seconds. That is fast by Rust standards — I have worked on Bevy projects where a single-line change triggers 45 seconds of recompilation — but 12 seconds is an eternity when you are tuning a spawn curve.

The data-driven architecture removes the compile step entirely for gameplay tuning. I edit `enemies.toml`, save, and the game picks it up within a second. No recompile. No `cargo check`. The feedback loop for balance changes dropped from *minutes* to *seconds*, and that changed how I design encounters. Instead of spending 12 seconds mentally context-switching every time I tweaked a number, I could stay in the game, watch the effect, adjust, watch again. It was like the difference between writing a sentence and waiting for a pen to refill after every word.

The cost was upfront: every TOML loader, every `serde::Deserialize` derive, every `#[serde(default)]` fallback, every graceful error path. That cost felt real during week one. By week two, it had paid for itself at least ten times over.

### The Borrow Checker vs. Hot-Reload

Hot-reloading Lua scripts while the game runs is easy. Lua's state is managed by `mlua`, and recompiling a chunk is a function call. The old chunk gets garbage-collected, the new one takes over. No borrow checker involvement.

Hot-reloading Rust data files while assets are loaded was harder.

The core problem: when `ui.toml` changes on disk, I need to deserialize the new values and swap them into the live `UiTheme` struct. But `UiTheme` is behind an `Arc<RwLock<UiTheme>>` that gets read on every frame. Swapping the inner value means acquiring a write lock, which blocks the render thread if it is mid-read.

The solution was a generation counter. The hot-reload watcher sets a `dirty` flag. At the start of each frame, the runtime checks the flag, acquires a write lock if dirty, deserializes the new file, and swaps. If the deserialize fails, the old values stay live and the error is logged. The renderer never blocks for more than a few microseconds.

This was the most time I have spent on a "minor quality of life" feature. Three evenings of staring at thread-sanitizer output because I had a double-lock edge case. My daughter was teething. I was not at my best. But the result — edit a label, save, see it change within one second while the game is still running — is one of the most satisfying things in the project. Every time I use it, I forget the three evenings.

### The rustpython-vm Disaster

The original plan was to embed Python for scripting. Python is more accessible than Lua, more people know it, and I wanted the modding barrier to be as low as possible.

I tried `rustpython-vm` first. It compiled — eventually — and worked on Linux. On Windows, Windows 11 AppLocker blocked the build scripts that `rustpython-vm` needs to compile its vendored Python fork. Exit code 4551, which I had never seen before and have now memorised against my will. The error is not actionable for most users: "this program is blocked by group policy." My machine, my dev environment, and Windows decided I could not run the Python that rustpython-vm needed to build itself.

I spent two days trying to work around it. I disabled AppLocker. I tried different Rust toolchains. I tried building without vendored Python. I tried a different fork. Nothing worked on my primary Windows machine.

I switched to `mlua` with Lua 5.4 vendored. Lua compiles as C — no build scripts, no AppLocker issues, no drama. It compiled on the first `cargo build` and has never caused a build problem since.

The trade-off is that modders need to learn Lua instead of Python. Lua is a simpler language — one table, one string type, first-class functions, no classes. You can learn it in an afternoon. But it is less familiar than Python, and I have to accept that some potential modders will bounce off the unfamiliar syntax.

I think the trade-off was correct. A scripting language that does not compile is useless. Lua compiles everywhere, is embeddable in 30 lines of C, and has a spec you can read in an hour. It is the SQLite of scripting languages — boring, reliable, and exactly what you need for embedding.

---

## The Architecture That Says "Yes"

The single most important design decision was the import boundary between `src/game/` and `src/runtime/`. The `src/game/` modules — combat, enemies, player, dialogue, ECS — never import Macroquad. They operate on plain data structures: `Vec2`, `f32`, `HashMap`, `enum`. The `src/runtime/` modules handle rendering, input, audio, and window management.

Why does this matter for modding? Because it means the game logic does not depend on the rendering framework. If I need to swap Macroquad for something else later, I can. If a modder wants to run the game logic headless for testing, they can. If I want to expose game state to Lua without dragging in OpenGL context management, the game state is already clean and framework-free.

I did not design this boundary with modding in mind. I designed it because I had been burned by entangled code in previous prototypes and wanted cleaner separation. The modding benefit was a side effect. But it turned out to be the most important side effect in the project.

---

## Graceful Degradation as a Modding Feature

The game never crashes on a missing or malformed data file.

I did not design this for modders initially. I designed it for *myself*, at 1 AM, when I typo'd a TOML field and the game crashed, and I had to wait 12 seconds for a recompile to fix it. I decided that was unacceptable and wrote every loader to fall back to sane defaults on error.

Once that pattern was in place, I realised it was also a modding feature. A modder editing `enemies.toml` will, at some point, leave a comma out or misspell a field name. The game should not crash. It should log the error, use the default value, and let the modder see the result — and fix it — without restarting.

This is now a rule: every public data loading path degrades gracefully. `serde::Deserialize` with `#[serde(default)]` on every optional field. TOML parse errors log with the file path and line number. Missing files log a warning and return defaults. The debug overlay (F1) shows the most recent Lua error, so the modder knows exactly what broke and where.

---

## The Asset Packer

Releases ship everything in `data.pak`. But the game checks for loose `Assets/` files first. This means a mod can override a single file — `Assets/Data/enemies.toml` — while everything else loads from the pack. The modder does not need to unpack, edit, and repack the whole archive. They drop one file next to the executable and it works.

The packer itself (`src/bin/asset_pack.rs`) was rewritten three times. First version: naive recursive directory copy. Second version: zip-based with a manifest. Third and current version: custom binary format with optional XOR encryption, inventory discovery, and `--dry-run --list` verification.

The design principle: the packer should be *invisible* to modders. They should not need to know it exists for simple overrides. Only when they want to distribute a full mod — new sprites, new dialogue, new scripts — do they need to touch the packer, and when they do, the `asset_pack --unpack` flag lets them decode any release into editable loose files.

---

## What I Got Wrong

**The Lua API surface is too small.** As of v0.10.4, Lua can control spawn waves and register hooks. It cannot change the player's stats mid-run, trigger dialogue, or modify ability cooldowns. I wanted to expose everything at once and got paralysed by the design decisions — should the API be callback-based or event-driven? Should modifiers return new values or mutate state? I shipped a minimal API because shipping *something* was better than shipping nothing, and I was right to do so, but the gap between "Lua can spawn enemies" and "Lua can rewrite the entire game" is still too wide.

**The mod pack format does not exist yet.** `Mods/<mod_id>/mod.toml` is a TODO item. Mods currently work by replacing files in `Assets/`, which means two mods that edit the same file conflict. The additive layer system (`spawn.d/*.lua`) solves this for scripts, but not for data files. I need a layered override system for TOML — something like "base values from `data.pak`, then `Mods/alpha/Data/enemies.toml` overrides specific fields, then `Mods/beta/Data/enemies.toml` overrides further." Skyrim's mod system does this. I should have designed it from the start instead of treating file-level overrides as sufficient.

**I underestimated the documentation burden.** `Docs/MODDING.md` is 15+ pages and growing. Every new moddable feature means updating the guide. I have started treating documentation as part of the feature — if a new `Assets/Data/*.toml` file lands, the PR is not complete until `MODDING.md` is updated. But the guide is already long enough that a new modder might not read it all, and the signals in the code itself — examples, comments, default values in TOML — are not yet strong enough to substitute.

---

## The Neurologist's Perspective

I spend my clinical days studying how the brain constructs its sense of self. One of the things I have learned is that the self is not a fixed structure — it is a process, a negotiation between competing subsystems, each with its own priorities and blind spots. The internal critic is not "you" any more than the impulse to run from danger is "you." They are both processes that your consciousness aggregates into a story about being a person.

I think moddability in games is the same principle applied to software.

A game is not a fixed object. It is a process — a negotiation between the developer's intent, the player's agency, and the runtime's constraints. A game that cannot be reshaped is a game that has mistaken itself for a finished thing. A game that invites reshaping is a game that understands itself as a process.

I want EchoWarrior to be the second kind. Not because modders will make it better — they might, they might not — but because the *invitation* itself is the point. The architecture says "you are allowed to change this." That permission is rare in commercial software and should not be.

---

## What It Feels Like Now

Open the `Assets/Data/` folder. There are 23 TOML files. Every stat, spawn timing, colour, label, cooldown, dialogue line, and weather setting in the game lives in one of them.

No hardcoded arrays. No magic numbers in Rust source. No "edit this constant and recompile to change how fast the player moves." Every number is a line in a file that any human being can open in any text editor and change.

I put the game in front of a non-programmer friend last week. I said "open `Assets/Data/player.toml`, find `move_speed`, and change it to `500`." They did. The character moved twice as fast. They laughed. Then they started scrolling through other files, changing numbers, seeing what happened. They spent an hour modding a game they had never seen before, without writing a single line of code.

That is the entire point of this project.

---

## A Note to My Future Daughter

If you are reading this years from now, and you want to change the game: open `Assets/Data/enemies.toml` and find the slime. Change its `speed` to `300`. Save the file. Start the game. Watch the slime fly across the screen at triple speed and laugh.

Then open `Assets/Dialogue/leere.yaml` and change what Leere says to you. They will never know you rewrote their lines. But you will.

Then open `Assets/Scripts/spawn.lua` and change the spawn waves. Make everything spawn at once. Make nothing spawn at all. Make enemies spawn only on the left side of the screen and watch them all clump up.

Everything in that `Assets/` folder is your sandbox. I built it that way on purpose. Not because you asked for it — you were not born yet — but because I wanted the world to have at least one game that says "yes" before you finish asking.

Now go break something and figure out how to fix it.

---

## Technical Appendix: The Numbers

- **23** TOML data files in `Assets/Data/`
- **1** YAML dialogue file per NPC (5 total)
- **2** Lua script entry points (base + additive layers)
- **~3,500** lines of `src/data/` loader code
- **0** hardcoded gameplay values in `src/game/` or `src/runtime/`
- **3** embedded scripting runtimes attempted (rustpython-vm × fail, mlua ✓)
- **~15 pages** of modding documentation and growing
- **1** non-programmer who successfully modded the game within 60 seconds of sitting down

---

*Next time: the companion AI, A\* pathfinding with string-pull smoothing, and why I spent three days debugging a Y-axis projection.*
