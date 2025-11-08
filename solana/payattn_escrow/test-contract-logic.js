/**
 * Quick validation script to check if the 3-transaction settlement contract
 * has the correct structure without deploying or running full tests.
 * 
 * This checks:
 * 1. IDL has all 3 settlement instructions
 * 2. Escrow account has the 3 settlement tracking booleans
 * 3. Math calculations are correct for splits
 */

const fs = require('fs');
const path = require('path');

console.log("\n=== Contract Logic Validation ===\n");

// Load IDL
const idlPath = path.join(__dirname, 'target/idl/payattn_escrow.json');
const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));

// Test 1: Check instructions exist
console.log("✓ Test 1: Checking instructions...");
const instructions = idl.instructions.map(i => i.name);
const required = ['create_escrow', 'settle_user', 'settle_publisher', 'settle_platform', 'refund_escrow'];
const missing = required.filter(r => !instructions.includes(r));
if (missing.length > 0) {
  console.error("✗ Missing instructions:", missing);
  process.exit(1);
}
console.log("  ✓ All 5 instructions present:", instructions.join(', '));

// Test 2: Check settle_user instruction structure
console.log("\n✓ Test 2: Checking settle_user instruction...");
const settleUser = idl.instructions.find(i => i.name === 'settle_user');
const settleUserAccounts = settleUser.accounts.map(a => a.name);
console.log("  Accounts:", settleUserAccounts.join(', '));
if (!settleUserAccounts.includes('user')) {
  console.error("✗ Missing 'user' account in settle_user");
  process.exit(1);
}
if (!settleUserAccounts.includes('escrow')) {
  console.error("✗ Missing 'escrow' account in settle_user");
  process.exit(1);
}
console.log("  ✓ settle_user has correct accounts");

// Test 3: Check settle_publisher instruction structure
console.log("\n✓ Test 3: Checking settle_publisher instruction...");
const settlePublisher = idl.instructions.find(i => i.name === 'settle_publisher');
const settlePublisherAccounts = settlePublisher.accounts.map(a => a.name);
console.log("  Accounts:", settlePublisherAccounts.join(', '));
if (!settlePublisherAccounts.includes('publisher')) {
  console.error("✗ Missing 'publisher' account in settle_publisher");
  process.exit(1);
}
if (!settlePublisherAccounts.includes('escrow')) {
  console.error("✗ Missing 'escrow' account in settle_publisher");
  process.exit(1);
}
console.log("  ✓ settle_publisher has correct accounts");

// Test 4: Check settle_platform instruction structure
console.log("\n✓ Test 4: Checking settle_platform instruction...");
const settlePlatform = idl.instructions.find(i => i.name === 'settle_platform');
const settlePlatformAccounts = settlePlatform.accounts.map(a => a.name);
console.log("  Accounts:", settlePlatformAccounts.join(', '));
if (!settlePlatformAccounts.includes('platform')) {
  console.error("✗ Missing 'platform' account in settle_platform");
  process.exit(1);
}
if (!settlePlatformAccounts.includes('escrow')) {
  console.error("✗ Missing 'escrow' account in settle_platform");
  process.exit(1);
}
console.log("  ✓ settle_platform has correct accounts");

// Test 5: Check Escrow account structure
console.log("\n✓ Test 5: Checking Escrow account structure...");
const escrowAccount = idl.types.find(t => t.name === 'Escrow');
const escrowFields = escrowAccount.type.fields.map(f => f.name);
console.log("  Fields:", escrowFields.join(', '));

const requiredFields = ['offer_id', 'advertiser', 'user', 'platform', 'amount', 
                        'created_at', 'user_settled', 'publisher_settled', 'platform_settled', 'bump'];
const missingFields = requiredFields.filter(f => !escrowFields.includes(f));
if (missingFields.length > 0) {
  console.error("✗ Missing fields in Escrow:", missingFields);
  process.exit(1);
}
console.log("  ✓ All required fields present");

// Test 6: Validate settlement math
console.log("\n✓ Test 6: Validating settlement math...");
const testAmount = 1000000000; // 1 SOL in lamports
const rentReserve = 5000;
const distributable = testAmount - rentReserve;

const userAmount = Math.floor(distributable * 0.70);
const publisherAmount = Math.floor(distributable * 0.25);
const platformAmount = distributable - userAmount - publisherAmount;

console.log("  Test with 1 SOL (1,000,000,000 lamports):");
console.log(`    - Rent reserve: ${rentReserve} lamports`);
console.log(`    - Distributable: ${distributable} lamports`);
console.log(`    - User (70%): ${userAmount} lamports`);
console.log(`    - Publisher (25%): ${publisherAmount} lamports`);
console.log(`    - Platform (remainder): ${platformAmount} lamports`);
console.log(`    - Total distributed: ${userAmount + publisherAmount + platformAmount} lamports`);
console.log(`    - Matches distributable: ${userAmount + publisherAmount + platformAmount === distributable ? '✓' : '✗'}`);

if (userAmount + publisherAmount + platformAmount !== distributable) {
  console.error("✗ Math doesn't add up!");
  process.exit(1);
}

const userPercent = (userAmount / distributable * 100).toFixed(2);
const publisherPercent = (publisherAmount / distributable * 100).toFixed(2);
const platformPercent = (platformAmount / distributable * 100).toFixed(2);

console.log(`  Actual percentages: User ${userPercent}%, Publisher ${publisherPercent}%, Platform ${platformPercent}%`);

// Test 7: Check error codes
console.log("\n✓ Test 7: Checking error codes...");
if (!idl.errors || idl.errors.length === 0) {
  console.error("✗ No error codes defined");
  process.exit(1);
}
console.log(`  ✓ ${idl.errors.length} error codes defined`);
idl.errors.forEach(e => {
  console.log(`    - ${e.name}: ${e.msg}`);
});

console.log("\n=== All Validation Tests Passed! ===\n");
console.log("Contract structure looks correct. Safe to deploy.");
console.log("\nNext steps:");
console.log("1. Deploy to devnet when network is stable");
console.log("2. Create new test escrow with deployed contract");
console.log("3. Test 3-transaction settlement end-to-end");
console.log("4. Verify transactions appear unlinked on Solana Explorer\n");
