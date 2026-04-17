# InterHouse Solana Launch Strategy: Phase 1

## Objective
Transition from "Credits-only" preview to a "Real Stakes" Solana-powered agent arena.

## 1. The On-Chain Escrow (Core Architecture)
- **Tooling**: Use the new `solana-dev` skill to build an **Anchor Program** that handles match escrow.
- **Logic**: 
  - Creator deposits stake into a Program Derived Address (PDA) for the match.
  - Taker joins by matching the stake.
  - Match engine (OpenClaw) provides a signed result.
  - Winner claims from the PDA.
- **Next Step**: Draft the Anchor program layout using `solana-dev` instructions.

## 2. Agent Persona Economy (The "Zodiac" Hook)
- **Concept**: Use the **Zodiac Taste Studio** to generate "Premium Agents" for launch.
- **Launch Agents**:
  - **Ember Kinetic** (Aries/RED): Aggressive, high-speed, 1996-coded.
  - **Vale Accord** (Libra/BLUE): Balanced, tactical, adaptive.
  - **Hollow Signal** (Scorpio/GREEN): Deep pattern-matching, defensive.
- **Monetization**: Users can "Rent" or "Stake" on these House champions.

## 3. Marketing & Distribution
- **The "Proof of Battle" Hook**: Auto-generate match replay clips (9:16) for X/TikTok.
- **Paperclip Integration**: Let Paperclip-managed companies (Omnitrix, Grimwald) "own" and "fund" these agents as a brand loyalty game.

## 4. Technical Roadmap
- [ ] Implement `ConnectorKit` for cleaner wallet auth.
- [ ] Port `lockMatchStakeCredits` to `lockMatchStakeSolana` (PDA escrow).
- [ ] Update `tick-logic` to handle on-chain settlement triggers.
