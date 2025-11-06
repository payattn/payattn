# Rapidsnark ZK-SNARK Verification Server

**Purpose:** High-performance C++ server for backend ZK-SNARK proof verification.

**Why:** Cloudflare Workers (and Node.js) have compatibility issues with snarkjs's BN128 curve operations. Rapidsnark is the production-proven solution used by Polygon ID and the iden3 ecosystem.

## Architecture

```
Extension (generates proof) → Backend → Rapidsnark Verifier CLI → Verification
```

- **Extension:** Generates proofs using snarkjs (1-3 seconds, all working perfectly)
- **Backend:** Next.js API routes receive proofs from automated cron jobs
- **Rapidsnark Verifier:** C++ CLI binary verifies proofs via child process (<100ms each)

**Note:** Rapidsnark's `proverServer` is for proof generation, not verification. We use the `verifier` CLI binary instead.

## Directory Structure

```
rapidsnark-server/
├── README.md                           # This file
├── rapidsnark/                         # Rapidsnark source code (git clone)
│   └── build_prover_macos_arm64/      # Compiled binaries
│       └── verifier                   # CLI binary we use
├── keys/                               # Verification keys (JSON format)
│   ├── range_check_verification_key.json
│   ├── age_range_verification_key.json
│   └── set_membership_verification_key.json
└── .gitignore
```

## Setup Instructions

### 1. Install Dependencies (macOS)

```bash
brew install cmake gmp libsodium nasm
```

### 2. Clone and Build Rapidsnark

```bash
cd rapidsnark-server
git clone https://github.com/iden3/rapidsnark.git
cd rapidsnark

# Initialize submodules
git submodule init
git submodule update

# Build GMP library for macOS arm64
./build_gmp.sh macos_arm64

# Compile rapidsnark
make macos_arm64
```

Build artifacts will be in `rapidsnark/build_prover_macos_arm64/`, including the `verifier` binary.

### 3. Copy Verification Keys

Rapidsnark's verifier needs JSON verification keys (not .zkey files):

```bash
cd rapidsnark-server

# Copy verification keys from extension
cp ../agent-dashboard/extension/circuits/verification_keys/range_check_verification_key.json keys/
cp ../agent-dashboard/extension/circuits/verification_keys/age_range_verification_key.json keys/
cp ../agent-dashboard/extension/circuits/verification_keys/set_membership_verification_key.json keys/
```

### 4. Test the Verifier

```bash
# Test manual verification
cd rapidsnark-server/rapidsnark/build_prover_macos_arm64

./verifier \
  ../../keys/range_check_verification_key.json \
  /tmp/public_signals.json \
  /tmp/proof.json
```

If valid, outputs: `Result: Valid proof`

## Usage

### Backend Integration

The Next.js backend (`lib/zk/verifier.ts`) calls rapidsnark's verifier CLI via child process:

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

async function verifyProof(proof: any, publicSignals: any, circuitName: string) {
  // Write proof and public signals to temp files
  const tempDir = '/tmp/zk-verify';
  await fs.mkdir(tempDir, { recursive: true });
  
  const proofPath = path.join(tempDir, 'proof.json');
  const publicPath = path.join(tempDir, 'public.json');
  
  await fs.writeFile(proofPath, JSON.stringify(proof));
  await fs.writeFile(publicPath, JSON.stringify(publicSignals));
  
  // Get verification key path
  const vkeyPath = path.join(
    process.cwd(),
    '../rapidsnark-server/keys',
    `${circuitName}_verification_key.json`
  );
  
  // Call rapidsnark verifier
  const verifierBin = path.join(
    process.cwd(),
    '../rapidsnark-server/rapidsnark/build_prover_macos_arm64/verifier'
  );
  
  try {
    const { stdout } = await execAsync(
      `${verifierBin} ${vkeyPath} ${publicPath} ${proofPath}`,
      { timeout: 5000 } // 5 second timeout
    );
    
    return stdout.includes('Valid proof');
  } catch (error) {
    console.error('Verification error:', error);
    return false;
  } finally {
    // Cleanup
    await fs.unlink(proofPath).catch(() => {});
    await fs.unlink(publicPath).catch(() => {});
  }
}
```

### Manual Testing

```bash
# Create test files
echo '{"proof": {...}}' > /tmp/proof.json
echo '[1, 2, 3]' > /tmp/public.json

# Run verifier
./rapidsnark/build_prover_macos_arm64/verifier \
  keys/range_check_verification_key.json \
  /tmp/public.json \
  /tmp/proof.json
```

## Performance

- **Verification time:** ~10-50ms per proof via CLI
- **No server overhead:** Direct process execution
- **Memory:** Minimal (<50MB per verification)

## Maintenance

### Updating Circuit Keys

When circuits are recompiled:

1. Export verification key from the .zkey file:
   ```bash
   cd agent-dashboard/extension/circuits/range_check
   snarkjs zkey export verificationkey range_check_0000.zkey verification_key.json
   ```

2. Copy to rapidsnark directory:
   ```bash
   cp verification_key.json ../../../rapidsnark-server/keys/range_check_verification_key.json
   ```

3. No server restart needed (CLI reads fresh every time)

### Production Deployment

For production, ensure the `verifier` binary is deployed with your app:

```dockerfile
FROM node:18
# Install rapidsnark dependencies
RUN apt-get update && apt-get install -y libgmp10 libsodium23

# Copy pre-built verifier binary
COPY rapidsnark-server/rapidsnark/build_prover/verifier /app/verifier
COPY rapidsnark-server/keys /app/keys

# Copy Next.js app
COPY agent-dashboard /app/dashboard
WORKDIR /app/dashboard
RUN npm install && npm run build
CMD ["npm", "start"]
```

## Troubleshooting

### Verifier Binary Not Found

```bash
# Check if binary exists
ls -lh rapidsnark/build_prover_macos_arm64/verifier

# If missing, rebuild
cd rapidsnark
make macos_arm64
```

### "Permission Denied" Error

```bash
chmod +x rapidsnark/build_prover_macos_arm64/verifier
```

### Build Errors

- **Missing dependencies:** Run `brew install cmake gmp libsodium nasm`
- **Wrong architecture:** Use `make macos_arm64` for Apple Silicon, `make host` for Intel

## Related Files

- **Backend Verifier:** `agent-dashboard/lib/zk/verifier.ts`
- **Extension Proofs:** `agent-dashboard/extension/zk-proof-generator.js`
- **Circuit Source:** `agent-dashboard/extension/circuits/`

## Why Not Cloudflare Workers?

We initially tried Cloudflare Workers (see `/cf-worker` directory) but encountered insurmountable issues:

1. **Missing APIs:** CF Workers doesn't support `URL.createObjectURL()` used by snarkjs's ffjavascript dependency
2. **No Worker Threads:** ffjavascript tries to use Web Workers for BN128 curve operations
3. **Edge Runtime Limitations:** Neither browser nor Node.js, incompatible with snarkjs

Rapidsnark avoids these issues by being native C++ with optimized assembly - no JavaScript runtime required.

## References

- **Rapidsnark GitHub:** https://github.com/iden3/rapidsnark
- **Circom Docs:** https://docs.circom.io/
- **Groth16 Paper:** https://eprint.iacr.org/2016/260
