use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("6ZEekbTJZ6D6KrfSGDY2ByoWENWfe8RzhvpBS4KtPdZr");

#[program]
pub mod payattn_escrow {
    use super::*;

    /// Create a new escrow for an ad offer
    /// Locks advertiser SOL in escrow PDA until impression is settled
    pub fn create_escrow(
        ctx: Context<CreateEscrow>,
        offer_id: String,
        amount: u64,
    ) -> Result<()> {
        // Transfer SOL from advertiser to escrow PDA first
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.advertiser.to_account_info(),
                to: ctx.accounts.escrow.to_account_info(),
            },
        );
        system_program::transfer(cpi_context, amount)?;

        // Now populate escrow account data
        let escrow = &mut ctx.accounts.escrow;
        escrow.offer_id = offer_id.clone();
        escrow.advertiser = ctx.accounts.advertiser.key();
        escrow.user = ctx.accounts.user.key();
        escrow.publisher = ctx.accounts.publisher.key();
        escrow.platform = ctx.accounts.platform.key();
        escrow.amount = amount;
        escrow.settled = false;
        escrow.bump = ctx.bumps.escrow;

        msg!(
            "Escrow created: offer_id={}, amount={} lamports",
            offer_id,
            amount
        );
        Ok(())
    }

    /// Settle an impression: transfer SOL from escrow to user/publisher/platform
    /// Splits: 70% to user, 25% to publisher, 5% to platform
    pub fn settle_impression(ctx: Context<SettleImpression>) -> Result<()> {
        let escrow = &ctx.accounts.escrow;
        require!(!escrow.settled, EscrowError::AlreadySettled);

        let amount = escrow.amount;

        // Calculate splits (70/25/5)
        let user_amount = (amount * 70) / 100;
        let publisher_amount = (amount * 25) / 100;
        let platform_amount = amount - user_amount - publisher_amount;

        // Generate PDA signer seeds
        let offer_id = escrow.offer_id.as_str();
        let seeds = &[
            b"escrow",
            offer_id.as_bytes(),
            &[escrow.bump],
        ];
        let signer = &[&seeds[..]];

        // Transfer to user (70%)
        let cpi_context = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.escrow.to_account_info(),
                to: ctx.accounts.user.to_account_info(),
            },
            signer,
        );
        system_program::transfer(cpi_context, user_amount)?;

        // Transfer to publisher (25%)
        let cpi_context = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.escrow.to_account_info(),
                to: ctx.accounts.publisher.to_account_info(),
            },
            signer,
        );
        system_program::transfer(cpi_context, publisher_amount)?;

        // Transfer to platform (5%)
        let cpi_context = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.escrow.to_account_info(),
                to: ctx.accounts.platform.to_account_info(),
            },
            signer,
        );
        system_program::transfer(cpi_context, platform_amount)?;

        // Mark as settled
        let escrow_mut = &mut ctx.accounts.escrow;
        escrow_mut.settled = true;

        msg!(
            "Impression settled: user={}, publisher={}, platform={} lamports",
            user_amount,
            publisher_amount,
            platform_amount
        );
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(offer_id: String)]
pub struct CreateEscrow<'info> {
    #[account(
        init,
        payer = advertiser,
        space = 8 + 128 + 32 + 32 + 32 + 32 + 8 + 1 + 1, // discriminator + offer_id + 4 pubkeys + amount + settled + bump
        seeds = [b"escrow", offer_id.as_bytes()],
        bump
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(mut)]
    pub advertiser: Signer<'info>,
    
    /// CHECK: User pubkey stored in escrow
    pub user: UncheckedAccount<'info>,
    
    /// CHECK: Publisher pubkey stored in escrow
    pub publisher: UncheckedAccount<'info>,
    
    /// CHECK: Platform pubkey stored in escrow
    pub platform: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettleImpression<'info> {
    #[account(mut)]
    pub escrow: Account<'info, Escrow>,

    /// CHECK: Receives 70% of escrow
    #[account(mut)]
    pub user: UncheckedAccount<'info>,
    
    /// CHECK: Receives 25% of escrow
    #[account(mut)]
    pub publisher: UncheckedAccount<'info>,
    
    /// CHECK: Receives 5% of escrow
    #[account(mut)]
    pub platform: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[account]
pub struct Escrow {
    pub offer_id: String,      // 128 bytes
    pub advertiser: Pubkey,    // 32 bytes
    pub user: Pubkey,          // 32 bytes
    pub publisher: Pubkey,     // 32 bytes
    pub platform: Pubkey,      // 32 bytes
    pub amount: u64,           // 8 bytes
    pub settled: bool,         // 1 byte
    pub bump: u8,              // 1 byte
}

#[error_code]
pub enum EscrowError {
    #[msg("Escrow has already been settled")]
    AlreadySettled,
}
