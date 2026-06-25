---
title: 'Devlog #4 — The Eight Decisions That Matter'
description: 'The eight architecture decisions behind EchoWarrior’s modding-first design, with the real code that makes them work.'
pubDate: '2026-06-25T12:00:00.000Z'
status: 'published'
tags:
  - rust
  - architecture
  - modding
  - gamedev
---

**Focus:** Architectural deep-dive — the real code behind the modding philosophy

---

I do not trust "genius" as a label for anything I wrote. Most of what follows came from being burned one too many times — the import wall because I spent weeks untangling game-from-renderer code on a previous prototype, the graceful degradation because I crashed at 1 AM over a missing comma in a TOML file, the dynamic enemy identity because I was tired of adding enum variants. Genius is a story you tell after the fact. In the moment, it is just pain avoidance.

That said, these eight decisions are the ones I keep coming back to and thinking *that was the right call.* Each one is annotated with the real source code that makes it work.

---

## 1. The Import Wall

The single most important line of code in the project is not in any function body. It is the boundary between `src/game/` and `src/runtime/`.

The game modules — combat, enemies, player, dialogue, ECS — never import Macroquad. They operate on this:

```rust
// src/game/mod.rs — the entire Vec2 type, no framework in sight
#[derive(Debug, Clone, Copy, Default, PartialEq)]
pub struct Vec2 {
    pub x: f32,
    pub y: f32,
}

impl Vec2 {
    pub const ZERO: Self = Self { x: 0.0, y: 0.0 };
    pub fn length(self) -> f32 { ... }
    pub fn normalized_or_zero(self) -> Self { ... }
}
```

Fifty lines. No external dependency. Zero compile-time cost. And because of it, every game module is framework-agnostic. I can unit-test enemy movement without a GPU. I can swap Macroquad for wgpu, Bevy, or a headless server without touching game logic. The rendering code imports the game code — never the other way around.

The module structure in `src/lib.rs` enforces this:

```rust
// src/lib.rs
pub mod game;     // pure logic, no rendering
pub mod runtime;  // Macroquad, rendering, input, audio
pub mod data;     // serde + TOML, no rendering
pub mod ui;       // layout helpers, no framework
```

I did not design this boundary for modding. I designed it because I was tired of fighting entangled game-renderer code in previous prototypes. The modding benefit — clean, framework-free game state that Lua can access without dragging in an OpenGL context — was a side effect. It turned out to be the most important side effect in the project.

---

## 2. The Graceful Degradation Pattern

Every single data loader in the project follows the same shape:

```rust
// src/data/mod_data.rs — the pattern that never crashes
pub fn load_player_config() -> PlayerConfig {
    load_player_config_from("Assets/Data/player.toml")
}

pub fn load_player_config_from(path: &str) -> PlayerConfig {
    match crate::asset_pack::read_to_string(path) {
        Ok(text) => match toml::from_str::<PlayerConfig>(&text) {
            Ok(cfg) => {
                eprintln!("[data] loaded player config from '{path}'");
                return cfg;
            }
            Err(e) => eprintln!("[data] player.toml parse error: {e}"),
        },
        Err(e) => eprintln!("[data] cannot read '{path}': {e}"),
    }
    PlayerConfig::default()
}
```

Every loader has a `_from` variant that takes a path. Every loader logs errors and returns defaults. No crash. No panic. No unwrap.

This was designed for me, at 1 AM, when I typo'd a TOML field and the game crashed, and I had to wait 12 seconds for a recompile. But it is also the most important modding feature in the project. A modder editing `enemies.toml` will leave a comma out. The game should not punish them for it.

The defaults are exhaustive:

```rust
// Every field gets a default function
fn default_edge_spawn_offset() -> f32 { 80.0 }
fn default_enemy_scale() -> f32 { 1.0 }
fn default_enemy_anim_fps() -> f32 { 8.0 }
fn default_contact_radius() -> f32 { 30.0 }
fn default_enemy_attack_cooldown() -> f32 { 1.2 }
fn default_enemy_attack_range() -> f32 { 0.0 }
fn default_enemy_attack_windup() -> f32 { 0.25 }
fn default_npc_scale() -> f32 { 1.5 }
fn default_npc_anim_fps() -> f32 { 7.0 }
fn default_npc_interact_radius() -> f32 { 72.0 }
```

This is not clever code. It is boring code, written in advance, for the moment when something goes wrong. That is the whole point.

---

## 3. Dynamic Enemy Identity — No Enums

The enemy system does not use a Rust enum. Enemies are identified by string, looked up in a `HashMap<String, EnemyDef>` loaded from TOML, and constructed at runtime:

```rust
// src/runtime/mod.rs — spawning an enemy from a Lua command
fn spawn_enemy_at(&mut self, kind: &str, position: Vec2) {
    let Some(def) = self.enemy_defs.get(kind) else {
        warn!(kind, "spawn script requested unknown enemy kind");
        return;
    };
    self.enemies.push(EnemyRuntime::from_def(position, def));
}
```

That `warn!` and `return` is the entire modding contract. A modder can type any enemy id into a Lua script. If it exists in `enemies.toml`, it spawns. If it does not, the game logs a warning and skips it — it does not crash, does not halt, does not complain beyond a line in the debug overlay.

The old approach was a `#[derive(Hash)]` enum with a `match` statement. Every new enemy meant a new variant and a new match arm. That is a compiler-level gate on modding. The new approach is a TOML entry and a `HashMap::get`.

The cost was giving up compile-time guarantees on enemy ids. A typo in an enum variant is caught by the compiler. A typo in a TOML string is caught at runtime — or, better, by `cargo run --bin mod_check`, which validates every id cross-reference before the game launches. The trade-off is worth it.

---

## 4. The Additive Spawn Layer System

Mods that edit `spawn.lua` directly risk conflicts. Two mods doing that is a merge problem. The additive layer system solves it:

```rust
// src/scripting/mod.rs — loading layers from spawn.d/
fn refresh_spawn_layers(&mut self) -> bool {
    // ...discover all .lua files under spawn.d/...
    for path in &paths {
        match WatchedScript::load(path) {
            Ok(layer) => layers.push(layer),
            Err(e) => { /* log, keep old layers */ }
        }
    }
    self.spawn_layers = layers;
}
```

A modder drops a file at `Assets/Scripts/spawn.d/my_mod.lua`:

```lua
-- This file lives next to the release data.pak and just works
echo_warrior.on_spawn_wave("my_mod.extra_hounds", function(ctx)
    if ctx.run_seconds < 60 then return {} end
    return echo_warrior.spawn_enemy("ShadeHound", ctx.player_x + 300, ctx.player_y)
end)
```

The base `spawn.lua` is never touched. The layer loads after it, registers a hook, and the engine calls all hooks every spawn tick. If one hook throws a Lua error, the other hooks and the base wave still run:

```rust
// Error isolation: one broken hook does not kill the wave
fn call_event_hooks(...) -> Option<String> {
    // ...
    for hook_entry in hooks.sequence_values::<LuaTable>() {
        match callback.call(...) {
            Ok(cmds) => commands.append(&mut cmds),
            Err(e) => {
                let msg = format!("hook '{name}' error: {e}");
                first_error.get_or_insert(msg);
                // continue — other hooks still fire
            }
        }
    }
    first_error // reported in F1 overlay, not fatal
}
```

The directory path `spawn.d/` is derived from the base script path automatically:

```rust
fn spawn_layer_dir(path: &str) -> Option<String> {
    let path = Path::new(path);
    let parent = path.parent()?;
    let stem = path.file_stem()?.to_str()?;
    Some(crate::asset_pack::normalize_asset_path(
        &parent.join(format!("{stem}.d")).to_string_lossy(),
    ))
}
```

Rename `spawn.lua` to `waves.lua` and the layer directory becomes `waves.d/` automatically. Zero configuration.

---

## 5. The Hot-Reload Generation Counter

Hot-reloading Lua is easy — Lua state is managed by `mlua`, and recompiling a chunk is a function call. Hot-reloading Rust data files into a live struct was harder.

The solution: a generation counter and a dirty flag:

```rust
fn poll_ui_config_reload(&mut self) {
    let current = file_mtime_seconds(&self.ui_cfg_path);
    if current.is_some() && current != self.ui_cfg_last_modified {
        match read_ui_config_from(&self.ui_cfg_path) {
            Ok(cfg) => {
                self.ui_cfg = cfg;
                self.ui_cfg_last_modified = current;
                info!("hot-reloaded UI config '{}'", self.ui_cfg_path);
            }
            Err(error) => {
                // Parse failed — keep old values, log the error,
                // but update mtime so we do not retry every frame
                self.ui_cfg_last_modified = current;
                warn!("could not hot-reload: {error}; keeping previous values");
            }
        }
    }
}
```

The renderer reads `self.ui_cfg` without a lock because PrototypeRuntime is not sent across threads. The hot-reload pass runs at the start of `update()`, before any render code reads the config. No mutex contention, no double-lock edge case, no thread-sanitizer nightmares.

The mtime update on parse failure is the subtle genius: without it, a malformed TOML file would be re-parsed every frame, flooding stderr with the same error 60 times per second. With it, the error prints once, the old config stays live, and the modder can fix and save without restarting the game.

---

## 6. The Asset Packer That Disappears

The packer is invisible to modders. Loose files win over packed files:

```rust
// src/asset_pack.rs — the fallback chain
pub fn read(path: impl AsRef<Path>) -> io::Result<Vec<u8>> {
    let path_ref = path.as_ref();
    // Try the filesystem first
    if let Ok(bytes) = fs::read(path_ref) {
        return Ok(bytes);
    }
    // Fall back to data.pak
    if let Some(bytes) = read_from_default_pack(path_ref) {
        return Ok(bytes);
    }
    fs::read(path_ref) // final attempt with proper error
}
```

A modder overrides `Assets/Data/enemies.toml` by placing that single file next to the executable. Everything else — sprites, dialogue, Lua, audio, shaders — loads from `data.pak`. One file override, no repacking, no tools needed.

The pack discovery itself searches multiple locations so it works whether the binary is run from a build directory, a release folder, or a zip extraction:

```rust
fn default_pack_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    // Next to the executable
    if let Ok(exe_path) = env::current_exe()
        && let Some(exe_dir) = exe_path.parent()
    {
        push_unique_path(&mut candidates, exe_dir.join(DEFAULT_PACK_PATH));
    }
    // Current working directory
    if let Ok(current_dir) = env::current_dir() {
        push_unique_path(&mut candidates, current_dir.join(DEFAULT_PACK_PATH));
    }
    // Explicit path
    push_unique_path(&mut candidates, PathBuf::from(DEFAULT_PACK_PATH));
    candidates
}
```

---

## 7. The Enemy Spawn Graceful Skip

When Lua requests an unknown enemy id, the game says "I do not know that enemy" and moves on. It does not crash. It does not halt. It logs a warning visible in the F1 overlay:

```rust
fn spawn_enemy_at(&mut self, kind: &str, position: Vec2) {
    let Some(def) = self.enemy_defs.get(kind) else {
        warn!(kind, "spawn script requested unknown enemy kind");
        return;  // ← the entire modding contract in one line
    };
    self.enemies.push(EnemyRuntime::from_def(position, def));
}
```

This single `return` is the difference between "my mod broke the game" and "my mod did nothing and told me why." The debug overlay shows the error, the modder sees the typo, fixes the Lua file, saves, and the script reloads within one second.

The same pattern extends to the Lua layer directory watcher. When a directory scan fails, the old layers stay active:

```rust
fn scan_spawn_layers_if_due(&mut self) -> bool {
    let now = Instant::now();
    if now < self.next_spawn_layer_scan {
        return false;
    }
    self.next_spawn_layer_scan = now + SPAWN_LAYER_SCAN_INTERVAL;
    self.refresh_spawn_layers()
}
```

One-second throttle on directory scans means a rapid delete+write cycle during mod development does not trigger a cascade of recompile events.

---

## 8. Every Field Has a Default

There is not a single `#[serde(default)]` omission in the data module where it makes sense. Every struct field that can reasonably have a default value has one:

```rust
#[derive(Debug, Clone, Deserialize)]
pub struct EnemyDef {
    pub id: String,          // no default — required
    pub hp: f32,             // no default — required
    pub speed: f32,          // no default — required
    pub damage: f32,         // no default — required
    #[serde(default = "default_enemy_scale")]
    pub scale: f32,          // default = 1.0
    #[serde(default = "default_enemy_anim_fps")]
    pub anim_fps: f32,       // default = 8.0
    #[serde(default = "default_contact_radius")]
    pub contact_radius: f32, // default = 30.0
    #[serde(default = "default_enemy_attack_cooldown")]
    pub attack_cooldown: f32, // default = 1.2
}
```

A modder adding a new enemy to `enemies.toml` can omit `scale`, `anim_fps`, `contact_radius`, `attack_cooldown`, `attack_range`, and `attack_windup`. The game fills in sensible defaults. The TOML file is as short as:

```toml
[[enemy]]
id = "MyCustomEnemy"
display_name = "My Custom Enemy"
hp = 50.0
speed = 100.0
damage = 12.0
xp_value = 4
sprite = "skeleton"
frame_w = 48
frame_h = 48
archetype = "Shadow"
```

Six fields omitted. Six things a modder does not need to know about. That is not laziness — it is deliberate reduction of the friction involved in adding something new.

---

Around the time I wrote these defaults, my daughter was learning to walk. She would stand up, take three steps, fall, look confused, stand up again. She did not know what a default value was, but she was living the philosophy: the system should catch you when you fall and let you try again without punishing you for the attempt.

These eight decisions are not clever. They are defensive. They assume the person using the system will make mistakes, and they try to make those mistakes cost nothing.

That is the entire philosophy of the project.
