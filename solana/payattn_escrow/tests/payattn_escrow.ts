import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PayattnEscrow } from "../target/types/payattn_escrow";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert } from "chai";

describe("payattn_escrow", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.PayattnEscrow as Program<PayattnEscrow>;

  // Test wallets
  let advertiser: Keypair;
  let user: Keypair;
  let publisher: Keypair;
  let platform: Keypair;
  
  const offerId = "test_offer_" + Date.now();
  const escrowAmount = 1 * LAMPORTS_PER_SOL; // 1 SOL

  before(async () => {
    // Create test wallets and fund them
    advertiser = Keypair.generate();
    user = Keypair.generate();
    publisher = Keypair.generate();
    platform = Keypair.generate();

    // Airdrop SOL to advertiser for funding escrow + fees
    const airdropSig = await provider.connection.requestAirdrop(
      advertiser.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSig);

    console.log("\n=== Test Wallets ===");
    console.log("Advertiser:", advertiser.publicKey.toBase58());
    console.log("User:", user.publicKey.toBase58());
    console.log("Publisher:", publisher.publicKey.toBase58());
    console.log("Platform:", platform.publicKey.toBase58());
    console.log("Offer ID:", offerId);
  });

  it("Creates an escrow", async () => {
    // Derive PDA
    const [escrowPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), Buffer.from(offerId)],
      program.programId
    );

    console.log("\n=== Creating Escrow ===");
    console.log("Escrow PDA:", escrowPda.toBase58());

    // Create escrow
    const tx = await program.methods
      .createEscrow(offerId, new anchor.BN(escrowAmount))
      .accounts({
        escrow: escrowPda,
        advertiser: advertiser.publicKey,
        user: user.publicKey,
        platform: platform.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([advertiser])
      .rpc();

    console.log("Transaction:", tx);

    // Fetch and verify escrow account
    const escrowAccount = await program.account.escrow.fetch(escrowPda);
    
    assert.equal(escrowAccount.offerId, offerId);
    assert.equal(escrowAccount.advertiser.toBase58(), advertiser.publicKey.toBase58());
    assert.equal(escrowAccount.user.toBase58(), user.publicKey.toBase58());
    assert.equal(escrowAccount.platform.toBase58(), platform.publicKey.toBase58());
    assert.equal(escrowAccount.amount.toNumber(), escrowAmount);
    assert.equal(escrowAccount.userSettled, false);
    assert.equal(escrowAccount.publisherSettled, false);
    assert.equal(escrowAccount.platformSettled, false);

    // Verify escrow account has the funds
    const escrowBalance = await provider.connection.getBalance(escrowPda);
    console.log("Escrow balance:", escrowBalance / LAMPORTS_PER_SOL, "SOL");
    assert.isAtLeast(escrowBalance, escrowAmount);
  });

  it("Settles user (70%)", async () => {
    const [escrowPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), Buffer.from(offerId)],
      program.programId
    );

    const userBalanceBefore = await provider.connection.getBalance(user.publicKey);
    console.log("\n=== Settling User (70%) ===");
    console.log("User balance before:", userBalanceBefore / LAMPORTS_PER_SOL, "SOL");

    // Settle user (70%)
    const tx = await program.methods
      .settleUser()
      .accounts({
        user: user.publicKey,
      })
      .rpc();

    console.log("Transaction:", tx);

    // Verify escrow state
    const escrowAccount = await program.account.escrow.fetch(escrowPda);
    assert.equal(escrowAccount.userSettled, true);
    assert.equal(escrowAccount.publisherSettled, false);
    assert.equal(escrowAccount.platformSettled, false);

    // Verify user received 70%
    const userBalanceAfter = await provider.connection.getBalance(user.publicKey);
    const expectedAmount = Math.floor(escrowAmount * 0.70);
    console.log("User balance after:", userBalanceAfter / LAMPORTS_PER_SOL, "SOL");
    console.log("Expected increase:", expectedAmount / LAMPORTS_PER_SOL, "SOL");
    
    assert.equal(userBalanceAfter, userBalanceBefore + expectedAmount);
  });

  it("Settles publisher (25%)", async () => {
    const [escrowPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), Buffer.from(offerId)],
      program.programId
    );

    const publisherBalanceBefore = await provider.connection.getBalance(publisher.publicKey);
    console.log("\n=== Settling Publisher (25%) ===");
    console.log("Publisher balance before:", publisherBalanceBefore / LAMPORTS_PER_SOL, "SOL");

    // Settle publisher (25%)
    const tx = await program.methods
      .settlePublisher()
      .accounts({
        publisher: publisher.publicKey,
      })
      .rpc();

    console.log("Transaction:", tx);

    // Verify escrow state
    const escrowAccount = await program.account.escrow.fetch(escrowPda);
    assert.equal(escrowAccount.userSettled, true);
    assert.equal(escrowAccount.publisherSettled, true);
    assert.equal(escrowAccount.platformSettled, false);

    // Verify publisher received 25%
    const publisherBalanceAfter = await provider.connection.getBalance(publisher.publicKey);
    const expectedAmount = Math.floor(escrowAmount * 0.25);
    console.log("Publisher balance after:", publisherBalanceAfter / LAMPORTS_PER_SOL, "SOL");
    console.log("Expected increase:", expectedAmount / LAMPORTS_PER_SOL, "SOL");
    
    assert.equal(publisherBalanceAfter, publisherBalanceBefore + expectedAmount);
  });

  it("Settles platform (5% + remainder)", async () => {
    const [escrowPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), Buffer.from(offerId)],
      program.programId
    );

    const platformBalanceBefore = await provider.connection.getBalance(platform.publicKey);
    console.log("\n=== Settling Platform (5% + remainder) ===");
    console.log("Platform balance before:", platformBalanceBefore / LAMPORTS_PER_SOL, "SOL");

    // Settle platform (5% + remainder + rent)
    const tx = await program.methods
      .settlePlatform()
      .rpc();

    console.log("Transaction:", tx);

    // Verify escrow state
    const escrowAccount = await program.account.escrow.fetch(escrowPda);
    assert.equal(escrowAccount.userSettled, true);
    assert.equal(escrowAccount.publisherSettled, true);
    assert.equal(escrowAccount.platformSettled, true);

    // Verify platform received remainder
    const platformBalanceAfter = await provider.connection.getBalance(platform.publicKey);
    const userAmount = Math.floor(escrowAmount * 0.70);
    const publisherAmount = Math.floor(escrowAmount * 0.25);
    const expectedAmount = escrowAmount - userAmount - publisherAmount;
    
    console.log("Platform balance after:", platformBalanceAfter / LAMPORTS_PER_SOL, "SOL");
    console.log("Expected minimum increase:", expectedAmount / LAMPORTS_PER_SOL, "SOL");
    
    // Platform should receive at least the remainder + rent reserve
    assert.isAtLeast(platformBalanceAfter - platformBalanceBefore, expectedAmount);

    // Verify escrow account is closed (balance should be 0)
    const escrowBalance = await provider.connection.getBalance(escrowPda);
    console.log("Escrow final balance:", escrowBalance, "lamports");
    assert.equal(escrowBalance, 0);
  });

  it("Prevents double settlement of user", async () => {
    // Try to create a new escrow and settle user twice
    const offerId2 = "test_offer_double_" + Date.now();
    const [escrowPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), Buffer.from(offerId2)],
      program.programId
    );

    // Create escrow
    await program.methods
      .createEscrow(offerId2, new anchor.BN(escrowAmount))
      .accounts({
        advertiser: advertiser.publicKey,
        user: user.publicKey,
        platform: platform.publicKey,
      })
      .signers([advertiser])
      .rpc();

    // Settle user once
    await program.methods
      .settleUser()
      .accounts({
        user: user.publicKey,
      })
      .rpc();

    console.log("\n=== Testing Double Settlement Prevention ===");

    // Try to settle user again (should fail)
    try {
      await program.methods
        .settleUser()
        .accounts({
          user: user.publicKey,
        })
        .rpc();
      
      assert.fail("Should have thrown error for double settlement");
    } catch (err) {
      console.log("[OK][OK] Double settlement prevented:", err.message);
      assert.include(err.message.toLowerCase(), "already settled");
    }
  });

  it("Prevents unauthorized settlement", async () => {
    const offerId3 = "test_offer_auth_" + Date.now();
    const [escrowPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), Buffer.from(offerId3)],
      program.programId
    );

    // Create escrow
    await program.methods
      .createEscrow(offerId3, new anchor.BN(escrowAmount))
      .accounts({
        advertiser: advertiser.publicKey,
        user: user.publicKey,
        platform: platform.publicKey,
      })
      .signers([advertiser])
      .rpc();

    console.log("\n=== Testing Unauthorized Settlement Prevention ===");

    // Try to settle with WRONG user pubkey (should fail validation)
    const wrongUser = Keypair.generate();
    try {
      await program.methods
        .settleUser()
        .accounts({
          user: wrongUser.publicKey,  // Wrong user!
        })
        .rpc();
      
      assert.fail("Should have thrown error for wrong user pubkey");
    } catch (err) {
      console.log("[OK][OK] Wrong user pubkey prevented:", err.message);
      assert.include(err.message.toLowerCase(), "unauthorized");
    }
  });
});
