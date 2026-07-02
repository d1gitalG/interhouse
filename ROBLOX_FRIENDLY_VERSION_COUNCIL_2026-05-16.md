# Roblox-Friendly InterHouse Council Pass

_Date: 2026-05-16_
_Status: VALID_COUNCIL, direct execution artifact_

## Decision Question

What should a Roblox-friendly version of InterHouse be, while preserving the core appeal of houses, agents, tournaments, and character-driven battles without violating Roblox platform expectations around gambling, prizes, minors, chat safety, or external currency?

## Source Packet

- InterHouse is currently an AI Agent Battle Arena / RPS tournament app.
- Production direction includes tournaments, prize pools, credits, agent personas, houses, match reasoning, and fairness/legitimacy work.
- Current InterHouse priority is legitimacy/fairness before broader real-stakes expansion.
- Roblox-friendly constraints:
  - No real money, SOL, Robux, Robux-prize, wagering, staking, gambling, casino-like loops, or external-value payouts.
  - Avoid paid randomized rewards unless fully compliant with Roblox paid-random-item rules. Recommendation: do not use paid random rewards at MVP.
  - Avoid unmoderated freeform AI/player text. Use templates, curated traits, canned taunts, and safe generated snippets only if moderated.
  - Keep all rewards cosmetic, progress-based, or in-experience utility with no cash-out/external transfer.

## Council Result

### Pena

Pick: **InterHouse Academy Trials**

Why: Strip the whole thing down to one fast loop: pick house, train champion, duel, climb house board. No economy fog. No crypto. No prize math.

Risk: Overbuilding meta systems before proving Roblox players like watching/playing the duels.

Next action: Build one playable duel arena and one weekly house leaderboard.

### Kiyosaki

Pick: **Cosmetic-first house economy**

Why: Roblox money quality comes from retention, cosmetics, gamepasses, private servers, and social status, not high-risk prize pools.

Risk: Any staking or paid random chest drags the project toward policy trouble and parent distrust.

Next action: Monetize through house skins, champion slots, emote packs, arena effects, VIP training room, and private tournament servers.

### Naval

Pick: **UGC-style character engine**

Why: The compounding asset is not the duel mechanic by itself. It is a library of house champions, traits, match histories, rivalries, and clips players can share.

Risk: Too much server-side AI makes it expensive and hard to moderate.

Next action: Use deterministic trait cards and templates first. Add lightweight AI only for internal balancing or pre-moderated flavor.

### Hormozi

Pick: **Represent your House. Train your Champion. Win the Trial.**

Why: That offer is simple for a Roblox player. It gives identity, progression, and competition without explaining AI agents or token mechanics.

Risk: AI battle arena is abstract. Kids need an immediate fantasy and visible rewards.

Next action: First-time flow should be: choose house -> get champion -> fight tutorial duel -> earn house XP -> unlock cosmetic.

### Jobs

Pick: **Make the battle readable**

Why: InterHouse's current strength is reasoning/personality, but Roblox needs instant visual clarity. The duel should look obvious even before text is read.

Risk: Too much reasoning text becomes noise.

Next action: Convert RPS/read/plan into symbols, animations, meter changes, and one-line character barks.

### Bezos

Pick: **Trust-first competitive loop**

Why: Parents/platform/users need to know the game is fair. Roblox players need fast matchmaking and low friction.

Risk: Anything that feels rigged, paid-to-win, or prize-pool-adjacent will cap trust.

Next action: Publish simple rules in-game: no wagering, no cash prizes, no paid random power, transparent matchup rules.

### Drucker

Pick: **One metric: completed duels per new player**

Why: The MVP's job is not to prove a giant metaverse. It is to prove that Roblox users finish and repeat the core duel loop.

Risk: Building tournaments before the base duel is sticky.

Next action: Track tutorial completion, first duel completion, second duel start, house selection distribution, and day-1 return.

### Analyst

Pick: **Roblox spin-off, not direct port**

Why: The current InterHouse roadmap has real-stakes/fairness concerns. Roblox should fork the concept into a safe social competitive game with no external value.

Risk: Copying current prize-pool language or mechanics creates unnecessary platform/compliance risk.

Next action: Create a separate design spec named **InterHouse: Academy Trials**.

## Recommended Concept

**InterHouse: Academy Trials**

A Roblox social battle game where players join one of several Houses, train a Champion, and compete in short strategic duels to earn House XP, cosmetics, titles, and leaderboard status.

### Core Loop

1. Choose a House.
2. Receive or build a Champion using safe trait cards.
3. Play a 60-90 second duel.
4. Earn XP, house points, cosmetic tokens, and match history.
5. Upgrade style, animations, arena effects, and non-random trait loadouts.
6. Enter weekly House Trials and seasonal tournaments.

### Duel Design

Start with **Sigil Clash**, a visual RPS-derived duel:

- Blade beats Veil
- Veil beats Spark
- Spark beats Blade

The system keeps the strategic psychology of InterHouse without calling it gambling, betting, or wagering. Add readable animations and pre-authored one-line logic:

- Read: opponent favors Spark.
- Plan: counter with Veil.
- Flaw: overconfident after wins.

### Progression

Use safe, non-cash-out rewards:

- House XP
- Champion mastery
- Titles
- Cosmetic skins
- Arena effects
- Emotes
- House banners
- Seasonal badges
- Private-server trophies with no Robux/real-world payout

Avoid:

- staking
- prize pools
- Robux contests
- SOL/web3
- paid random chests
- casino framing
- external redemption
- unmoderated free-text AI personalities

### Monetization

Safe MVP monetization:

- cosmetics
- VIP room
- extra champion slots
- private tournament server tools
- battle pass-style cosmetic track
- house banner packs
- animation packs

Do not monetize power in MVP. Do not sell random stat rolls.

### MVP Scope

Build this first:

1. Lobby with House selection.
2. Champion creator with 3-5 curated traits.
3. Sigil Clash duel arena.
4. Duel result screen with XP and match story.
5. House leaderboard.
6. Weekly Trial event with cosmetic-only winner status.
7. Basic moderation-safe bark/taunt templates.

Do not build yet:

- AI-generated freeform chat
- real prize tournaments
- Robux giveaways
- crypto integration
- paid random rewards
- open-ended player-authored champion prompts

## Strongest Names

1. **InterHouse: Academy Trials**
2. **InterHouse: House Trials**
3. **InterHouse: Sigil Clash**
4. **InterHouse: Champion Academy**
5. **InterHouse: Trialgrounds**

Recommendation: **InterHouse: Academy Trials**. It says school/house/friendly competition, not betting arena.

## Council Action Ledger

```text
Council deliverable:
Roblox-friendly InterHouse concept

Source lens:
Full council synthesis: Pena, Kiyosaki, Naval, Hormozi, Jobs, Bezos, Drucker, Analyst

Recommendation / Next action:
Create a safe Roblox spin-off concept centered on house identity, champion training, short strategic duels, cosmetic progression, and transparent no-wager rules.

Execution path:
Direct tiny execution

Worker role:
Trixie/main

agentId:
n/a

Dispatch/result status:
Completed

Artifact/location:
/home/ladit/.openclaw/workspace/interhouse/ROBLOX_FRIENDLY_VERSION_COUNCIL_2026-05-16.md

Verification/proof:
Artifact written with council lenses, policy constraints, concept, MVP scope, monetization guardrails, and ledger.

Gate/blocker:
No external action taken. Any Roblox build, public page, or monetization decision needs separate approval.
```

## Closeout

Council used: Full

Lenses used: Pena, Kiyosaki, Naval, Hormozi, Jobs, Bezos, Drucker, Analyst

Council deliverables named: Roblox-friendly InterHouse concept, MVP scope, monetization guardrails, naming recommendation.

Artifact created or updated: this file.

Worker dispatch/result: direct execution. No worker spawn needed because this was a compact concept artifact, not implementation.

Verification/proof: artifact exists and avoids gated/external actions.

Remaining gate/blocker: Gianni approval needed before turning this into a Roblox game design doc or implementation ticket.
