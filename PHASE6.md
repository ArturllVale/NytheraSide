# Phase 6: Offline & Idle Progression System

This document outlines the mechanics and configuration knobs for the offline progression system built during Phase 5.

## 1. System Overview
The Offline Catch-up system allows characters to earn experience, gold, and drops while disconnected from the server. To avoid spawning Node.js threads for every disconnected user, the game utilizes a **Lazy Evaluation approach**. When a user requests their offline claim (`/progress/claim-offline`), the server calculates the elapsed time and executes a deterministic mathematical batch approximation to award missing loot.

## 2. Default Configuration Knobs
These constants are defined in `apps/server/src/modules/progress/progress.service.ts` and can be adjusted:

- **`MAX_IDLE_SECONDS`**: `43,200` (12 Hours)
  - The absolute cap a character can accrue rewards before they must log in to claim.
- **`BATTLE_DURATION_SECONDS`**: `60` (1 Minute)
  - The baseline duration to clear a standard mob troop. E.g., 1 hour offline = 60 battles approximated.
- **Win Rate Approximation**: `95%`
  - In MVP, we mock an overarching 95% victory rate against the selected idle route. Future iterations will route this through the `BattleEngine` auto-play to determine exact win rates.

## 3. Mathematical Formulas
Upon `POST /progress/claim-offline`, the server calculates:

1. **Elapsed Time**: 
   `elapsed = min(now - last_synced_at, MAX_IDLE_SECONDS)`
2. **Battles to Simulate**: 
   `N = floor(elapsed / BATTLE_DURATION_SECONDS)`
3. **Deterministic Seed Generator**:
   We use the idempotency key `offline_claim:{characterId}:{windowStartIso}` mapped into a 32-bit integer via character code hashing. This feeds the `mulberry32` PRNG.
4. **Reward Accumulation (Loop N times)**:
   ```javascript
   if (rng() < 0.95) { // Win
       xp += Troop.BaseXP
       gold += Troop.BaseGold
       For Each Enemy In Troop:
           For Each Drop In Enemy:
               if (rng() < (1 / Drop.Denominator)) -> Add Drop
   }
   ```

## 4. Idempotency & Double-Claim Safety
We prevent race conditions (e.g., a user sending two claims back to back) by persisting the claim window into the `idempotency_keys` table inside the Postgres transaction before mutating their economy profile. If the `offline_claim:{charId}:{time}` key already exists, the `EconomyService` aborts the secondary claim securely.

## 5. API Reference
- `GET /progress/idle-status` - Returns elapsed seconds and potential battles to simulate.
- `POST /progress/claim-offline` - Executes the simulation and pushes the rewards to the DB.
- `POST /progress/set-route` - Assigns the character to a specific stage/troop ID to grind while offline.
- `POST /progress/set-strategy` - Future-proofing. Configures which auto-battle AI strategy is used when simulating the offline grind.