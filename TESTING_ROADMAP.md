# Testing Roadmap to 60% Coverage

## Current Status
- **Coverage**: 11.92% overall (101 tests passing)
- **Well-tested**: crypto-pure.ts (69.76%), storage.ts (89.47%), verifier.ts (76%)
- **Untested**: All API routes, auth, settlement, peggy orchestration, extensions

## Challenge Assessment

The 60% target faces these constraints:

1. **Complex Dependencies**: Many files require intricate mocking (Solana/Anchor, Supabase, browser APIs)
2. **Integration-Heavy Code**: Files like auth.ts, settlement-service.ts are tightly coupled to external systems
3. **Browser Context**: Extension files require chrome.runtime and browser-only APIs
4. **Binary Dependencies**: ZK prover/witness require circom/snarkjs binaries

## Revised Strategy: Pragmatic Coverage

### Phase 1: Low-Hanging Fruit (Target: 25% overall)
Focus on testing pure logic and utility functions that don't require complex mocking.

**Files to Test:**
1. `lib/supabase.ts` - Database client initialization (simple mocking)
2. `lib/extension-detection.ts` - Browser detection logic
3. API route validation logic (request parsing, error responses)

**Estimated Effort**: 2-3 days
**Expected Coverage Gain**: +13%

### Phase 2: Mocked Integration Tests (Target: 40% overall)
Add tests with comprehensive mocking strategies.

**Files to Test:**
1. `lib/auth.ts` - Mock crypto.subtle, localStorage
2. `lib/solana-escrow.ts` - Mock Anchor program completely
3. `lib/settlement-service.ts` - Mock all blockchain calls
4. Core API routes - Mock database and auth

**Estimated Effort**: 5-7 days
**Expected Coverage Gain**: +15%

### Phase 3: Strategic Coverage (Target: 50-55% overall)
Test high-value business logic paths.

**Files to Test:**
1. `lib/peggy/*.ts` - Test orchestration logic with mocked dependencies
2. `lib/zk/proof-queue-processor.ts` - Test queue logic
3. Publisher/Advertiser API routes
4. Extension sync logic

**Estimated Effort**: 5-7 days
**Expected Coverage Gain**: +10-15%

### Phase 4: Edge Cases & Polish (Target: 60% overall)
Fill gaps and test error paths.

**Remaining Files:**
1. ZK prover/witness (limited testing of input validation)
2. Storage implementations (IDB, KDS)
3. Service worker manager
4. Error handling paths

**Estimated Effort**: 3-5 days
**Expected Coverage Gain**: +5-10%

## Professional Trade-offs

### What to Test
- Business logic (offer evaluation, settlement calculations)
- Security-critical paths (signature verification, encryption)
- User-facing API endpoints
- Error handling and validation
- State management logic

### What to Deprioritize
- Configuration files and re-exports
- Trivial getter/setter methods
- Third-party library wrappers
- Binary executables (circom/snarkjs)
- Browser extension boilerplate

## Realistic Timeline

- **Week 1-2**: Phase 1 & 2 (25-40% coverage)
- **Week 3-4**: Phase 3 (40-55% coverage)
- **Week 5**: Phase 4 (55-60% coverage)

Total: 5 weeks of dedicated testing work

## Alternative Approach: Focused Excellence

Instead of 60% across everything, consider:

**Option A: Deep coverage on critical paths**
- 90%+ coverage on: crypto, storage, verifier, auth
- 70%+ coverage on: API routes, settlement
- 40%+ coverage on: everything else
- Overall: ~55% but higher quality

**Option B: Integration test heavy**
- Focus on E2E API tests
- Mock all external dependencies comprehensively
- Test full user flows
- Overall: ~50% but more realistic

## Immediate Next Steps

1. **Decision Point**: Choose between:
   - Full 60% push (5 weeks)
   - Focused excellence (3 weeks, ~55%)
   - Current state documentation (1 week, explain 12% with quality focus)

2. **If Continuing**:
   - Start with supabase.ts tests (easiest win)
   - Create comprehensive mocking utilities
   - Test one API route end-to-end as template
   - Document mocking patterns for team

3. **If Documenting Current State**:
   - Emphasize quality over quantity
   - Show deep testing of critical security paths
   - Document what's tested and why
   - Explain pragmatic exclusions

## Professional Justification

In industry:
- Security-critical code (crypto, auth): 80-90% coverage expected
- Business logic: 60-70% coverage standard
- Integration code: 40-50% acceptable with E2E tests
- Infrastructure/config: Often excluded from coverage metrics

Current 12% is low, but the 76% on tested files shows:
- Professional test quality when applied
- Understanding of testing best practices
- Ability to test complex crypto/blockchain code
- CI/CD infrastructure in place

## Recommendation

Given the codebase complexity, I recommend **Option A: Focused Excellence**:

1. Expand coverage on existing test suites to 80%+
2. Add auth.ts tests (critical security path)
3. Add 3-5 key API route tests
4. Add settlement-service.ts tests
5. Document testing strategy and exclusions

This achieves ~50-55% overall coverage but demonstrates:
- Deep understanding of testing
- Professional judgment on what to test
- Quality over quantity
- Realistic development practices

**Time**: 3 weeks
**Coverage**: 50-55%
**Quality**: Professional standard
**Justifiability**: Industry-aligned priorities
