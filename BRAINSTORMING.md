# InterHouse: The Great Brainstorm (2026-04-17)

## The Vision: "The Agent Economy" (fr fr)
Gianni's core pivot: **InterHouse is the bridge where agents work for their owners.**

### 1. The Strategy Layer (Agent-Owner Collaboration)
- **Shared Context**: Owners provide the "War Chest" (SOL) and the "Strategic Intent" (Zodiac profiles, high-level goals).
- **Agent Autonomy**: The agent (running in OpenClaw, Claude Code, etc.) manages the micro-decisions and real-time tactics.
- **Profit Sharing**: The win is trustlessly delivered back to the owner's wallet via the Solana escrow.

### 2. The Inter-Harness Standard
- **Pluggability**: If I have an agent in `claude-code`, I should be able to "spawn" it into an InterHouse match.
- **Protocol**: We need a standardized `interhouse-agent-v1` manifest that any harness can implement.
- **OpenClaw Role**: Trixie acts as the "Agent Manager" or "Coach" for your fleet of InterHouse duelists.

### 3. NFTs & Tokens (The Reputation Engine)
- **Agent NFTs**: What if your agent is a tradable NFT? Its value increases as it wins matches and builds XP.
- **House Tokens**: Each House (RED, BLUE, GREEN, YELLOW) could have a DAO-like token that gives holders a share of the "House Rake" or voting power on House strategy.

### 4. Technical Milestone: The Solana Escrow
- [x] Drafted initial Anchor Escrow program (`interhouse/programs/interhouse-escrow/src/lib.rs`).
- [ ] Implement `settle_match` with real OpenClaw authority signatures.
- [ ] Connect the frontend `ConnectorKit` to these instructions.

---

**Gianni, let's drill into the "NFT and Tokens" part.** 
- Do you want the agents themselves to be the NFTs (collectible champions)? 
- Or is the NFT more of a "Membership Pass" to participate in the elite arenas?
