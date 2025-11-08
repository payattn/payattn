use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("6ZEekbTJZ6D6KrfSGDY2ByoWENWfe8RzhvpBS4KtPdZr");

/// Duration in seconds before an escrow can be refunded (14 days)
const ESCROW_EXPIRY_DURATION: i64 = 14 * 24 * 60 * 60;

/// Revenue split percentages (70% user, 25% publisher, 5% platform as remainder)
const USER_PERCENTAGE: u64 = 70;
const PUBLISHER_PERCENTAGE: u64 = 25;

#[program]
pub mod payattn_escrow {
    use super::*;

    /// Creates a new escrow for an advertising impression
    ///
    /// This locks the advertiser's funds in a program-derived address (PDA)
    /// until the user views the ad and the impression is settled, or until
    /// the escrow expires and can be refunded.
    ///
    /// **Note:** Publisher is NOT required at creation time. The publisher
    /// will only be known when the user actually views the ad, and will be
    /// specified during settlement.
    ///
    /// # Arguments
    /// * `offer_id` - Unique identifier for this offer (used as PDA seed)
    /// * `amount` - Amount in lamports to lock in escrow
    ///
    /// # Errors
    /// * `InvalidAmount` - If amount is zero or insufficient
    pub fn create_escrow(
        ctx: Context<CreateEscrow>,
        offer_id: String,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, EscrowError::InvalidAmount);
        require!(
            offer_id.len() <= 64,
            EscrowError::OfferIdTooLong
        );

        let clock = Clock::get()?;
        let escrow = &mut ctx.accounts.escrow;

        // Initialize escrow state (publisher unknown at this point)
        escrow.offer_id = offer_id.clone();
        escrow.advertiser = ctx.accounts.advertiser.key();
        escrow.user = ctx.accounts.user.key();
        escrow.platform = ctx.accounts.platform.key();
        escrow.amount = amount;
        escrow.created_at = clock.unix_timestamp;
        escrow.settled = false;
        escrow.bump = ctx.bumps.escrow;

        // Transfer SOL from advertiser to escrow PDA
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.advertiser.to_account_info(),
                to: ctx.accounts.escrow.to_account_info(),
            },
        );
        system_program::transfer(cpi_context, amount)?;

        msg!(
            "Escrow created: offer_id={}, amount={} lamports, expires_at={}",
            offer_id,
            amount,
            clock.unix_timestamp + ESCROW_EXPIRY_DURATION
        );

        Ok(())
    }

    /// Settles an advertising impression after user views the ad
    ///
    /// Distributes the escrowed funds according to the revenue split:
    /// - 70% to the user who viewed the ad
    /// - 25% to the publisher hosting the ad
    /// - 5% to the platform
    ///
    /// **Note:** Publisher is specified at settlement time (not at escrow creation)
    /// because the publisher is only known when the user actually views the ad.
    ///
    /// # Errors
    /// * `AlreadySettled` - If this escrow has already been settled
    /// * `EscrowExpired` - If the escrow has expired (should be refunded instead)
    /// * `Unauthorized` - If the signer is not authorized to settle
    pub fn settle_impression(ctx: Context<SettleImpression>) -> Result<()> {
        let escrow = &ctx.accounts.escrow;
        let clock = Clock::get()?;

        // Validate escrow state
        require!(!escrow.settled, EscrowError::AlreadySettled);
        require!(
            clock.unix_timestamp <= escrow.created_at + ESCROW_EXPIRY_DURATION,
            EscrowError::EscrowExpired
        );

        // Verify user matches escrow
        require!(
            ctx.accounts.user.key() == escrow.user,
            EscrowError::Unauthorized
        );
        require!(
            ctx.accounts.platform.key() == escrow.platform,
            EscrowError::Unauthorized
        );

        let amount = escrow.amount;

        // Calculate revenue split
        let user_amount = amount
            .checked_mul(USER_PERCENTAGE)
            .and_then(|v| v.checked_div(100))
            .ok_or(EscrowError::MathOverflow)?;
        
        let publisher_amount = amount
            .checked_mul(PUBLISHER_PERCENTAGE)
            .and_then(|v| v.checked_div(100))
            .ok_or(EscrowError::MathOverflow)?;
        
        let platform_amount = amount
            .checked_sub(user_amount)
            .and_then(|v| v.checked_sub(publisher_amount))
            .ok_or(EscrowError::MathOverflow)?;

        // Generate PDA signer seeds
        let offer_id = escrow.offer_id.as_str();
        let seeds = &[b"escrow", offer_id.as_bytes(), &[escrow.bump]];
        let signer_seeds = &[&seeds[..]];

        // Transfer to user (70%)
        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.escrow.to_account_info(),
                    to: ctx.accounts.user.to_account_info(),
                },
                signer_seeds,
            ),
            user_amount,
        )?;

        // Transfer to publisher (25%)
        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.escrow.to_account_info(),
                    to: ctx.accounts.publisher.to_account_info(),
                },
                signer_seeds,
            ),
            publisher_amount,
        )?;

        // Transfer to platform (5%)
        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.escrow.to_account_info(),
                    to: ctx.accounts.platform.to_account_info(),
                },
                signer_seeds,
            ),
            platform_amount,
        )?;

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

    /// Refunds an expired escrow to the advertiser
    ///
    /// Can only be called after the escrow has expired (14 days after creation)
    /// and has not been settled. Returns all funds to the advertiser.
    ///
    /// # Errors
    /// * `NotExpired` - If the escrow expiry period has not elapsed
    /// * `AlreadySettled` - If the impression has already been settled
    /// * `Unauthorized` - If the caller is not the advertiser
    pub fn refund_escrow(ctx: Context<RefundEscrow>) -> Result<()> {
        let clock = Clock::get()?;
        
        // Extract values before mutable borrow
        let offer_id = ctx.accounts.escrow.offer_id.clone();
        let amount = ctx.accounts.escrow.amount;
        let created_at = ctx.accounts.escrow.created_at;
        let settled = ctx.accounts.escrow.settled;
        let advertiser = ctx.accounts.escrow.advertiser;
        let bump = ctx.accounts.escrow.bump;

        // Validate refund conditions
        require!(!settled, EscrowError::AlreadySettled);
        require!(
            clock.unix_timestamp > created_at + ESCROW_EXPIRY_DURATION,
            EscrowError::NotExpired
        );
        require!(
            ctx.accounts.advertiser.key() == advertiser,
            EscrowError::Unauthorized
        );

        // Generate PDA signer seeds
        let seeds = &[b"escrow", offer_id.as_bytes(), &[bump]];
        let signer_seeds = &[&seeds[..]];

        // Return all funds to advertiser
        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.escrow.to_account_info(),
                    to: ctx.accounts.advertiser.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;

        // Mark as settled to prevent double refund
        ctx.accounts.escrow.settled = true;

        msg!("Escrow refunded: offer_id={}, amount={} lamports", offer_id, amount);

        Ok(())
    }
}

// ============================================================================
// Account Validation Structs
// ============================================================================

#[derive(Accounts)]
#[instruction(offer_id: String)]
pub struct CreateEscrow<'info> {
    #[account(
        init,
        payer = advertiser,
        space = 8 + 128 + 32 + 32 + 32 + 8 + 8 + 1 + 1, // Removed publisher (32 bytes)
        seeds = [b"escrow", offer_id.as_bytes()],
        bump
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(mut)]
    pub advertiser: Signer<'info>,

    /// CHECK: User pubkey is validated and stored in escrow
    pub user: UncheckedAccount<'info>,

    /// CHECK: Platform pubkey is validated and stored in escrow
    pub platform: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettleImpression<'info> {
    #[account(mut)]
    pub escrow: Account<'info, Escrow>,

    /// CHECK: Validated against escrow.user in instruction
    #[account(mut)]
    pub user: UncheckedAccount<'info>,

    /// CHECK: Validated against escrow.publisher in instruction
    #[account(mut)]
    pub publisher: UncheckedAccount<'info>,

    /// CHECK: Validated against escrow.platform in instruction
    #[account(mut)]
    pub platform: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RefundEscrow<'info> {
    #[account(mut)]
    pub escrow: Account<'info, Escrow>,

    /// CHECK: Validated against escrow.advertiser in instruction
    #[account(mut)]
    pub advertiser: Signer<'info>,

    pub system_program: Program<'info, System>,
}

// ============================================================================
// State Definitions
// ============================================================================

#[account]
pub struct Escrow {
    /// Unique identifier for this advertising offer
    pub offer_id: String,
    /// Advertiser who created and funded the escrow
    pub advertiser: Pubkey,
    /// User who will view the ad and receive 70%
    pub user: Pubkey,
    /// Platform wallet, receives 5%
    pub platform: Pubkey,
    /// Amount locked in escrow (lamports)
    pub amount: u64,
    /// Unix timestamp when escrow was created
    pub created_at: i64,
    /// Whether the impression has been settled or refunded
    pub settled: bool,
    /// PDA bump seed for signing
    pub bump: u8,
}

// ============================================================================
// Error Codes
// ============================================================================

#[error_code]
pub enum EscrowError {
    #[msg("Escrow has already been settled or refunded")]
    AlreadySettled,

    #[msg("Escrow has expired and should be refunded")]
    EscrowExpired,

    #[msg("Escrow has not yet expired and cannot be refunded")]
    NotExpired,

    #[msg("Unauthorized: signer does not match expected party")]
    Unauthorized,

    #[msg("Invalid amount: must be greater than zero")]
    InvalidAmount,

    #[msg("Offer ID exceeds maximum length of 64 characters")]
    OfferIdTooLong,

    #[msg("Math operation overflow")]
    MathOverflow,
}
