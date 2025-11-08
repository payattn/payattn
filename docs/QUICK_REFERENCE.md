# ZK-SNARK Circuits - Quick Reference

## Available Circuits

| Circuit | Use Case | Private Input | Public Inputs | Example |
|---------|----------|---------------|---------------|---------|
| **age_range** | Age verification | age | minAge, maxAge | Prove 18+ |
| **range_check** | Any numeric range | value | min, max | Prove income $25k-$50k |
| **set_membership** | Categorical membership | hash(value) | hash(set[10]) | Prove location in [US, UK, CA] |

## Testing (Browser Console)

```javascript
// Age verification
testServiceWorkerProof(30, 18, 65)

// Income verification
testRangeCheck(35000, 25000, 50000)

// Location verification (requires hashing)
testSetMembership("uk", ["us", "uk", "ca", "au"])

// Hash a string
await hashToField("uk")  // Returns field element
```

## Extension Usage

### Range Proof (age, income, score)
```javascript
const proof = await generateProofInServiceWorker('range_check',
  { value: 35000 },           // Private
  { min: 25000, max: 50000 }, // Public
  { verbose: false }
);
```

### Set Membership (countries, interests)
```javascript
// Hash everything first!
const userHash = await hashToField("uk");
const setHashes = await hashStringsToField(["us", "uk", "ca"]);
while (setHashes.length < 10) setHashes.push("0");

const proof = await generateProofInServiceWorker('set_membership',
  { value: userHash },   // Private
  { set: setHashes },    // Public
  { verbose: false }
);
```

## Backend Verification

### Node.js
```javascript
const snarkjs = require('snarkjs');
const fs = require('fs');

// Load verification key
const vKey = JSON.parse(
  fs.readFileSync('verification_keys/range_check_verification_key.json')
);

// Verify proof
const verified = await snarkjs.groth16.verify(
  vKey,
  publicSignals,
  proof
);
```

### String Hashing (for set_membership)
```javascript
const crypto = require('crypto');
const FIELD_PRIME = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');

function hashToField(str) {
  const hash = crypto.createHash('sha256').update(str, 'utf8').digest();
  const num = BigInt('0x' + hash.toString('hex'));
  return (num % FIELD_PRIME).toString();
}
```

## File Locations

- **Extension circuits:** `extension/circuits/*/`
- **Verification keys:** `extension/circuits/verification_keys/`
- **Circuit source:** `/Users/jmd/nosync/is.jmd.zksnark/*.circom`
- **Test functions:** `extension/age-proof-test.js`

## Documentation

- **Hashing Scheme:** `circuits/HASHING_SCHEME.md`
- **Backend Guide:** `circuits/verification_keys/README.md`
- **Full Guide:** `SERVICE_WORKER_ZK_PROOF_GUIDE.md`
- **Circuit Development:** `CIRCUIT_DEVELOPMENT_GUIDE.md`
- **Implementation Summary:** `circuits/IMPLEMENTATION_SUMMARY.md`

## Common Patterns

### Campaign with Age + Location
```javascript
// Generate two proofs
const ageProof = await generateProofInServiceWorker('range_check',
  { value: userAge },
  { min: 18, max: 65 }
);

const locationHash = await hashToField(userCountry);
const allowedHashes = await hashStringsToField(["us", "uk", "ca"]);
while (allowedHashes.length < 10) allowedHashes.push("0");

const locationProof = await generateProofInServiceWorker('set_membership',
  { value: locationHash },
  { set: allowedHashes }
);

// Send both proofs to backend
await fetch('/api/verify', {
  method: 'POST',
  body: JSON.stringify({
    ageProof,
    locationProof
  })
});
```

## Performance

- range_check: ~1-2 seconds
- set_membership: ~2-3 seconds
- Total for both: ~3-5 seconds

## Troubleshooting

**"Circuit not found"**
- Check circuit name: 'range_check' or 'set_membership'

**"Invalid proof" on backend**
- Verify you're using correct verification key
- Check public signals match expectations
- For set_membership: Ensure hashing algorithm matches

**Set membership fails**
- Did you hash the strings?
- Did you pad set to 10 elements?
- Are you using same hash algorithm as backend?

## Security Checklist

✅ Proof generation happens in service worker (autonomous)  
✅ Private inputs never leave extension  
✅ Proofs sent to backend immediately  
✅ Backend verifies cryptographically  
✅ Backend checks public signals match campaign  
✅ Hashing scheme documented for backend  

---

**Quick Links:**
- Test circuits: Open `age-proof-test.html` in browser
- Backend examples: `circuits/verification_keys/README.md`
- Hashing details: `circuits/HASHING_SCHEME.md`
