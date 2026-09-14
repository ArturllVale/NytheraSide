# Content Pipeline

The content pipeline synchronizes game balance, skills, enemies, and items defined in the RPG Maker database (`data/*.json`) into the authoritative server database.

---

## 1. Data Source

Game design is edited using the RPG Maker MZ editor, which outputs JSON files into `data/`:
- `Actors.json`: Hero archetypes and visual sprite definitions.
- `Classes.json`: Classes, stat curves, and learnable skills.
- `Skills.json`: Damage formulas, MP costs, and effects.
- `Items.json`, `Weapons.json`, `Armors.json`: Inventory items and equipment.
- `Enemies.json`, `Troops.json`: Monster stats, actions, and encounter groups.
- `States.json`, `System.json`: Status effects, terms, and combat constants.

---

## 2. Synchronization & Versioning

- **Tool**: `tools/content-sync` provides both one-shot sync and automated file watcher capabilities.
- **Auto-Seed Fallback**: In local development, if no published content version exists when `/content/active` is queried, the server automatically reads `data/*.json` and generates initial Version 1 with the hash of the local database files.
- **Client Guard**: `NET_ContentGuard.js` verifies that the client is connected to a server with matching content version.

---

## 3. Sandboxed Formula Evaluation

RPG Maker skill formulas (e.g. `a.atk * 4 - b.def * 2`) are evaluated authoritatively on the server. To guarantee security and prevent remote code execution:
- Formulas run inside an **`isolated-vm`** sandbox.
- Execution timeout is strictly enforced at **10ms**.
- System functions and prototype access are stripped.
