# Comprehensive Testing Plan - 60% Coverage Target

## Current Status
- Coverage: 76.78% (but many files excluded)
- Tests: 129 passing
- Excluded files: 16+ lib files, all API routes

## Goal
Achieve 60%+ coverage across the entire codebase with professional testing practices.

## Phase 1: Remove Artificial Exclusions (Priority: HIGH)

### 1.1 Solana Escrow Integration Tests
File: `lib/solana-escrow.ts` (currently excluded)
Status: 34% coverage with basic PDA tests

**Action Items:**
- Add tests for `verifyEscrow()` with mocked Anchor program
- Add tests for `settleEscrow()` with mocked transactions
- Mock Solana connection and program calls
- Test error handling for network failures
- Target: 65% coverage

### 1.2 Authentication & Authorization
File: `lib/auth.ts` (currently excluded, 370 lines)

**Action Items:**
- Test wallet signature verification
- Test session token generation and validation
- Test nonce generation and verification
- Mock crypto operations
- Target: 70% coverage

### 1.3 Settlement Service
File: `lib/settlement-service.ts` (currently excluded, 357 lines)

**Action Items:**
- Test settlement calculation logic
- Test batching algorithms
- Test error recovery mechanisms
- Mock blockchain interactions
- Target: 60% coverage

## Phase 2: API Route Testing (Priority: HIGH)

### 2.1 Critical API Routes
**Routes to test:**
1. `/api/verify-proof/route.ts` - ZK proof verification endpoint
2. `/api/user/offer/route.ts` - User offer submission
3. `/api/advertiser/offers/pending/route.ts` - Offer queue
4. `/api/advertiser/assess/route.ts` - Offer assessment
5. `/api/publisher/impressions/route.ts` - Impression tracking

**Testing Strategy:**
- Create `app/api/__tests__/` directory structure
- Use supertest or Next.js route testing utilities
- Mock database calls with jest.mock()
- Mock authentication middleware
- Test request validation
- Test error responses (400, 401, 404, 500)
- Target: 55% coverage per route

### 2.2 API Testing Pattern
```typescript
// Example structure (no actual implementation yet)
describe('POST /api/verify-proof', () => {
  it('should verify valid proof', async () => {
    // Mock verifier
    // Send request
    // Assert 200 response
  });
  
  it('should reject invalid proof', async () => {
    // Send invalid data
    // Assert 400 response
  });
});
```

## Phase 3: Integration-Heavy Files (Priority: MEDIUM)

### 3.1 Storage Implementations
Files: `lib/storage-idb.ts`, `lib/storage-kds.ts`

**Action Items:**
- Test IndexedDB operations with fake-indexeddb library
- Test KDS API client methods
- Mock HTTP requests
- Target: 65% coverage each

### 3.2 Extension Integration
Files: `lib/extension-detection.ts`, `lib/extension-sync.ts`, `lib/service-worker-manager.ts`

**Action Items:**
- Mock browser APIs (chrome.runtime, etc)
- Test message passing protocols
- Test state synchronization
- Target: 60% coverage each

### 3.3 Peggy Agent Orchestration
Files: `lib/peggy/*.ts` (5 files)

**Action Items:**
- Test session management logic
- Test database query builders
- Test LLM evaluator prompts
- Test proof validation logic
- Test escrow funding calculations
- Mock all external dependencies
- Target: 60% coverage per file

## Phase 4: ZK-SNARK Infrastructure (Priority: MEDIUM)

### 4.1 Circuit Operations
Files: `lib/zk/prover.ts`, `lib/zk/witness.ts`, `lib/zk/hashing.ts`

**Action Items:**
- Mock circom/snarkjs binary calls
- Test input validation
- Test error handling for malformed inputs
- Test witness generation logic
- Target: 50% coverage (complex binary dependencies)

### 4.2 Proof Queue
File: `lib/zk/proof-queue-processor.ts`

**Action Items:**
- Mock database operations
- Test queue processing logic
- Test concurrent proof handling
- Test retry mechanisms
- Target: 65% coverage

## Phase 5: Configuration & Utilities (Priority: LOW)

### 5.1 Configuration Files
Files: `lib/zk/circuits-registry.ts`, `lib/zk/index.ts`
- Simple re-exports and configuration
- Target: Exclude from coverage (non-logic)

### 5.2 Example Code
Files: `lib/storage-examples.ts`
- Documentation/example code
- Target: Exclude from coverage

### 5.3 Trivial Utilities
Files: `lib/utils.ts`
- Single 5-line function
- Target: Exclude from coverage

## Implementation Schedule

### Week 1: Remove Core Exclusions
- Day 1-2: Solana escrow integration tests
- Day 3-4: Authentication tests
- Day 5: Settlement service tests
- Expected coverage after Week 1: 45%

### Week 2: API Routes
- Day 1-2: Critical API routes (verify-proof, user/offer)
- Day 3-4: Advertiser API routes
- Day 5: Publisher API routes
- Expected coverage after Week 2: 58%

### Week 3: Integration & Peggy
- Day 1-2: Storage implementations
- Day 3-4: Peggy orchestration files
- Day 5: Extension integration
- Expected coverage after Week 3: 65%

### Week 4: Polish & Documentation
- Day 1-2: ZK infrastructure tests
- Day 3: Update jest.config.js with final exclusions
- Day 4: Documentation updates
- Day 5: CI/CD refinement
- Final target: 62-65% coverage

## Testing Best Practices

### Mocking Strategy
1. **Database**: Mock Supabase client methods
2. **Blockchain**: Mock Solana connection and program calls
3. **HTTP**: Mock fetch() calls with jest-fetch-mock
4. **File System**: Mock fs operations
5. **External Binaries**: Mock child_process.exec

### Test Organization
```
lib/__tests__/
  auth.test.ts
  settlement-service.test.ts
  solana-escrow.test.ts (expand existing)
  storage-idb.test.ts
  storage-kds.test.ts
  extension-detection.test.ts
  extension-sync.test.ts
  service-worker-manager.test.ts

lib/peggy/__tests__/
  session-manager.test.ts
  database.test.ts
  llm-evaluator.test.ts
  proof-validator.test.ts
  escrow-funder.test.ts

lib/zk/__tests__/
  verifier.test.ts (existing)
  prover.test.ts
  witness.test.ts
  hashing.test.ts
  proof-queue-processor.test.ts

app/api/__tests__/
  verify-proof.test.ts
  user-offer.test.ts
  advertiser-offers.test.ts
  advertiser-assess.test.ts
  publisher-impressions.test.ts
```

### Coverage Configuration
```javascript
// Final jest.config.js excludes only:
collectCoverageFrom: [
  'lib/**/*.{ts,tsx}',
  'app/api/**/*.{ts,tsx}',
  '!lib/**/__tests__/**',
  '!app/api/__tests__/**',
  '!**/*.d.ts',
  '!**/node_modules/**',
  '!lib/zk/circuits-registry.ts',  // Config only
  '!lib/zk/index.ts',              // Re-exports only
  '!lib/storage-examples.ts',      // Documentation
  '!lib/utils.ts',                 // 5 lines
]
```

## Success Metrics

### Minimum Thresholds (60%)
- Overall statements: 60%
- Overall branches: 50%
- Overall functions: 60%
- Overall lines: 60%

### Target Thresholds (65%)
- Overall statements: 65%
- Overall branches: 55%
- Overall functions: 65%
- Overall lines: 65%

## Risk Mitigation

### High Complexity Areas
- **ZK Prover/Witness**: Binary dependencies make full coverage impractical
  - Mitigation: Focus on input validation and error paths (50% target)
  
- **Browser Extensions**: Chrome API dependencies
  - Mitigation: Comprehensive mocking with chrome.runtime stubs
  
- **Blockchain Integration**: Network calls and transaction signing
  - Mitigation: Mock Anchor program interface completely

### Time Management
- Prioritize high-value tests first (auth, API routes, settlements)
- Use existing test patterns as templates
- Parallelize test suite creation
- Set realistic per-file targets (not 100%)

## Next Steps

1. Update jest.config.js to remove exclusions
2. Start with Phase 1 (solana-escrow, auth, settlement)
3. Create test file templates
4. Implement mocking infrastructure
5. Run coverage reports iteratively
6. Adjust targets based on actual complexity

## Professional Standards

This plan follows industry best practices:
- Focus on business logic over boilerplate
- Pragmatic coverage targets (60-65%, not 100%)
- Comprehensive mocking strategy
- Integration test patterns for APIs
- Clear documentation of exclusions
- Realistic timelines with incremental milestones
