use anchor_lang::prelude::*;

declare_id!("ih_escrow_placeholder_pk_1111111111111111");

#[program]
pub mod interhouse_escrow {
    use super::*;

    /// Initialize a match escrow. Creator deposits the initial stake.
    pub fn initialize_match(
        ctx: Context<InitializeMatch>,
        match_id: String,
        stake_amount: u64,
    ) -> Result<()> {
        let match_account = &mut ctx.accounts.match_account;
        match_account.match_id = match_id;
        match_account.creator = ctx.accounts.creator.key();
        match_account.stake_amount = stake_amount;
        match_account.status = MatchStatus::Waiting;
        match_account.bump = ctx.bumps.match_account;

        // Transfer SOL from creator to the match PDA
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.creator.to_account_info(),
                to: ctx.accounts.match_account.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, stake_amount)?;

        Ok(())
    }

    /// Taker joins the match by matching the stake.
    pub fn join_match(ctx: Context<JoinMatch>) -> Result<()> {
        let match_account = &mut ctx.accounts.match_account;
        require!(match_account.status == MatchStatus::Waiting, InterHouseError::MatchNotJoinable);

        match_account.taker = Some(ctx.accounts.taker.key());
        match_account.status = MatchStatus::Active;

        // Transfer SOL from taker to the match PDA
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.taker.to_account_info(),
                to: ctx.accounts.match_account.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, match_account.stake_amount)?;

        Ok(())
    }

    /// Settle the match. Only the authorized engine (OpenClaw) can sign this.
    pub fn settle_match(ctx: Context<SettleMatch>, winner_pubkey: Pubkey) -> Result<()> {
        let match_account = &mut ctx.accounts.match_account;
        require!(match_account.status == MatchStatus::Active, InterHouseError::MatchNotSettlable);

        match_account.status = MatchStatus::Completed;
        match_account.winner = Some(winner_pubkey);

        // Transfer total stake (2x stake_amount) to the winner
        let total_stake = match_account.stake_amount.checked_mul(2).unwrap();
        
        **match_account.to_account_info().try_borrow_mut_lamports()? -= total_stake;
        **ctx.accounts.winner_account.try_borrow_mut_lamports()? += total_stake;

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(match_id: String)]
pub struct InitializeMatch<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + 32 + 32 + 32 + 8 + 1 + 32 + 1, // Basic sizing
        seeds = [b"match", match_id.as_bytes()],
        bump
    )]
    pub match_account: Account<'info, MatchAccount>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinMatch<'info> {
    #[account(
        mut,
        seeds = [b"match", match_account.match_id.as_bytes()],
        bump = match_account.bump
    )]
    pub match_account: Account<'info, MatchAccount>,
    #[account(mut)]
    pub taker: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettleMatch<'info> {
    #[account(
        mut,
        seeds = [b"match", match_account.match_id.as_bytes()],
        bump = match_account.bump,
        // Only the authorized engine authority can settle
        constraint = authority.key() == match_account.creator // Placeholder: update to actual engine auth
    )]
    pub match_account: Account<'info, MatchAccount>,
    /// CHECK: Recipient of the funds
    #[account(mut)]
    pub winner_account: AccountInfo<'info>,
    pub authority: Signer<'info>,
}

#[account]
pub struct MatchAccount {
    pub match_id: String, // Up to 32 chars
    pub creator: Pubkey,
    pub taker: Option<Pubkey>,
    pub winner: Option<Pubkey>,
    pub stake_amount: u64,
    pub status: MatchStatus,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum MatchStatus {
    Waiting,
    Active,
    Completed,
    Cancelled,
}

#[error_code]
pub enum InterHouseError {
    #[msg("Match is not in a joinable state.")]
    MatchNotJoinable,
    #[msg("Match is not in a settlable state.")]
    MatchNotSettlable,
}
