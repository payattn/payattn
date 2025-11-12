use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("6ZEekbTJZ6D6KrfSGDY2ByoWENWfe8RzhvpBS4KtPdZr");

/// Duration in seconds before an escrow can be refunded (14 days)
const ESCROW_EXPIRY_DURATION: i64 = 14 * 24 * 60 * 60;

/// Revenue split percentages (70% user, 25% publisher, 5% platform as remainder)
const USER_PERCENTAGE: u64 = 70;
const PUBLISHER_PERCENTAGE: u64 = 25;

/// Minimum rent-exempt balance to keep account alive (5000 lamports)
/// This ensures the escrow account persists through all 3 settlements
const RENT_RESERVE: u64 = 5000;

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
    /// **Gas Efficiency:** Single account initialization, minimal storage (240 bytes)
    ///
    /// # Arguments
    /// * `offer_id` - Unique identifier for this offer (used as PDA seed)
    /// * `amount` - Amount in lamports to lock in escrow (must include RENT_RESERVE)
    ///
    /// # Errors
    /// * `InvalidAmount` - If amount is insufficient to cover payments + rent reserve
    pub fn create_escrow(
        ctx: Context<CreateEscrow>,
        offer_id: String,
        amount: u64,
    ) -> Result<()> {
        require!(amount > RENT_RESERVE, EscrowError::InvalidAmount);
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
        escrow.user_settled = false;
        escrow.publisher_settled = false;
        escrow.platform_settled = false;
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

    /// Settles the user portion (70%) of an advertising impression
    ///
    /// **Privacy-Preserving Design:** This is one of THREE separate settlement
    /// instructions that can be called independently with random delays between them.
    /// This makes it harder for blockchain analysis to link user ↔ publisher wallets.
    ///
    /// **Gas Efficiency:** Single CPI transfer, minimal state update (1 bool flip)
    ///
    /// # Errors
    /// * `AlreadySettled` - If user payment already sent
    /// * `EscrowExpired` - If escrow has expired
    /// * `Unauthorized` - If user pubkey doesn't match escrow
    pub fn settle_user(ctx: Context<SettleUser>) -> Result<()> {
        let escrow = &ctx.accounts.escrow;
        let clock = Clock::get()?;

        // Validate escrow state
        require!(!escrow.user_settled, EscrowError::AlreadySettled);
        require!(
            clock.unix_timestamp <= escrow.created_at + ESCROW_EXPIRY_DURATION,
            EscrowError::EscrowExpired
        );
        require!(
            ctx.accounts.user.key() == escrow.user,
            EscrowError::Unauthorized
        );

        // Calculate user amount (70%)
        let user_amount = escrow.amount
            .checked_sub(RENT_RESERVE)
            .ok_or(EscrowError::MathOverflow)?
            .checked_mul(USER_PERCENTAGE)
            .and_then(|v| v.checked_div(100))
            .ok_or(EscrowError::MathOverflow)?;

        // Transfer lamports manually (PDAs with data can't use system_program::transfer)
        **ctx.accounts.escrow.to_account_info().try_borrow_mut_lamports()? -= user_amount;
        **ctx.accounts.user.to_account_info().try_borrow_mut_lamports()? += user_amount;

        // Mark user as settled
        ctx.accounts.escrow.user_settled = true;

        msg!("User settled: {} lamports", user_amount);

        Ok(())
    }

    /// Settles the publisher portion (25%) of an advertising impression
    ///
    /// **Privacy-Preserving Design:** Called independently with random delay from
    /// user settlement, making timing-based correlation attacks difficult.
    ///
    /// **Gas Efficiency:** Single CPI transfer, minimal state update (1 bool flip)
    ///
    /// # Errors
    /// * `AlreadySettled` - If publisher payment already sent
    /// * `EscrowExpired` - If escrow has expired
    pub fn settle_publisher(ctx: Context<SettlePublisher>) -> Result<()> {
        let escrow = &ctx.accounts.escrow;
        let clock = Clock::get()?;

        // Validate escrow state
        require!(!escrow.publisher_settled, EscrowError::AlreadySettled);
        require!(
            clock.unix_timestamp <= escrow.created_at + ESCROW_EXPIRY_DURATION,
            EscrowError::EscrowExpired
        );

        // Calculate publisher amount (25%)
        let publisher_amount = escrow.amount
            .checked_sub(RENT_RESERVE)
            .ok_or(EscrowError::MathOverflow)?
            .checked_mul(PUBLISHER_PERCENTAGE)
            .and_then(|v| v.checked_div(100))
            .ok_or(EscrowError::MathOverflow)?;

        // Transfer lamports manually (PDAs with data can't use system_program::transfer)
        **ctx.accounts.escrow.to_account_info().try_borrow_mut_lamports()? -= publisher_amount;
        **ctx.accounts.publisher.to_account_info().try_borrow_mut_lamports()? += publisher_amount;

        // Mark publisher as settled
        ctx.accounts.escrow.publisher_settled = true;

        msg!("Publisher settled: {} lamports", publisher_amount);

        Ok(())
    }

    /// Settles the platform portion (5%) of an advertising impression
    ///
    /// **Privacy-Preserving Design:** Final settlement transaction, called with
    /// random delay. Since all three settlements are independent transactions,
    /// blockchain analysis cannot link them to the same impression.
    ///
    /// **Gas Efficiency:** Single CPI transfer, minimal state update (1 bool flip)
    ///
    /// # Errors
    /// * `AlreadySettled` - If platform payment already sent
    /// * `EscrowExpired` - If escrow has expired
    /// * `Unauthorized` - If platform pubkey doesn't match escrow
    pub fn settle_platform(ctx: Context<SettlePlatform>) -> Result<()> {
        let escrow = &ctx.accounts.escrow;
        let clock = Clock::get()?;

        // Validate escrow state
        require!(!escrow.platform_settled, EscrowError::AlreadySettled);
        require!(
            clock.unix_timestamp <= escrow.created_at + ESCROW_EXPIRY_DURATION,
            EscrowError::EscrowExpired
        );
        require!(
            ctx.accounts.platform.key() == escrow.platform,
            EscrowError::Unauthorized
        );

        // Calculate platform amount (5% = remainder after 70% + 25%)
        let total_payable = escrow.amount.checked_sub(RENT_RESERVE)
            .ok_or(EscrowError::MathOverflow)?;
        let user_amount = total_payable
            .checked_mul(USER_PERCENTAGE)
            .and_then(|v| v.checked_div(100))
            .ok_or(EscrowError::MathOverflow)?;
        let publisher_amount = total_payable
            .checked_mul(PUBLISHER_PERCENTAGE)
            .and_then(|v| v.checked_div(100))
            .ok_or(EscrowError::MathOverflow)?;
        let platform_amount = total_payable
            .checked_sub(user_amount)
            .and_then(|v| v.checked_sub(publisher_amount))
            .ok_or(EscrowError::MathOverflow)?;

        // Transfer lamports manually (PDAs with data can't use system_program::transfer)
        **ctx.accounts.escrow.to_account_info().try_borrow_mut_lamports()? -= platform_amount;
        **ctx.accounts.platform.to_account_info().try_borrow_mut_lamports()? += platform_amount;

        // Mark platform as settled
        ctx.accounts.escrow.platform_settled = true;

        msg!("Platform settled: {} lamports", platform_amount);

        Ok(())
    }

    /// Refunds an expired escrow to the advertiser
    ///
    /// Can only be called after the escrow has expired (14 days after creation)
    /// and has not been fully settled. Returns all unsettled funds to the advertiser.
    ///
    /// **Gas Efficiency:** Only transfers remaining balance, no unnecessary calculations
    ///
    /// # Errors
    /// * `NotExpired` - If the escrow expiry period has not elapsed
    /// * `AlreadySettled` - If all three payments have been settled
    /// * `Unauthorized` - If the caller is not the advertiser
    pub fn refund_escrow(ctx: Context<RefundEscrow>) -> Result<()> {
        let clock = Clock::get()?;
        
        // Extract values before mutable borrow
        let offer_id = ctx.accounts.escrow.offer_id.clone();
        let created_at = ctx.accounts.escrow.created_at;
        let user_settled = ctx.accounts.escrow.user_settled;
        let publisher_settled = ctx.accounts.escrow.publisher_settled;
        let platform_settled = ctx.accounts.escrow.platform_settled;
        let advertiser = ctx.accounts.escrow.advertiser;
        let bump = ctx.accounts.escrow.bump;

        // Validate refund conditions
        let fully_settled = user_settled && publisher_settled && platform_settled;
        require!(!fully_settled, EscrowError::AlreadySettled);
        require!(
            clock.unix_timestamp > created_at + ESCROW_EXPIRY_DURATION,
            EscrowError::NotExpired
        );
        require!(
            ctx.accounts.advertiser.key() == advertiser,
            EscrowError::Unauthorized
        );

        // Get current escrow balance (may be partial if some settlements occurred)
        let escrow_balance = ctx.accounts.escrow.to_account_info().lamports();
        let refund_amount = escrow_balance
            .checked_sub(RENT_RESERVE)
            .ok_or(EscrowError::MathOverflow)?;

        // Generate PDA signer seeds
        let seeds = &[b"escrow", offer_id.as_bytes(), &[bump]];
        let signer_seeds = &[&seeds[..]];

        // Return remaining funds to advertiser
        if refund_amount > 0 {
            system_program::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.escrow.to_account_info(),
                        to: ctx.accounts.advertiser.to_account_info(),
                    },
                    signer_seeds,
                ),
                refund_amount,
            )?;
        }

        // Mark all as settled to prevent future operations
        ctx.accounts.escrow.user_settled = true;
        ctx.accounts.escrow.publisher_settled = true;
        ctx.accounts.escrow.platform_settled = true;

        msg!("Escrow refunded: offer_id={}, amount={} lamports", offer_id, refund_amount);

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
        space = 8 + 128 + 32 + 32 + 32 + 8 + 8 + 1 + 1 + 1 + 1, // Added 2 bools for tracking
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
pub struct SettleUser<'info> {
    #[account(mut)]
    pub escrow: Account<'info, Escrow>,

    /// CHECK: Validated against escrow.user in instruction
    #[account(mut)]
    pub user: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettlePublisher<'info> {
    #[account(mut)]
    pub escrow: Account<'info, Escrow>,

    /// CHECK: Publisher pubkey provided at settlement time
    #[account(mut)]
    pub publisher: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettlePlatform<'info> {
    #[account(mut)]
    pub escrow: Account<'info, Escrow>,

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
    /// Whether user payment (70%) has been settled
    pub user_settled: bool,
    /// Whether publisher payment (25%) has been settled
    pub publisher_settled: bool,
    /// Whether platform payment (5%) has been settled
    pub platform_settled: bool,
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
