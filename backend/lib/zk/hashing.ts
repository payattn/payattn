/**
 * ZK-SNARK Hashing Utilities (Backend)
 * 
 * Provides string-to-field hashing that matches the extension implementation.
 * Used for set_membership circuit verification.
 */

import * as crypto from 'crypto';

// BN128 field prime (must match extension)
export const FIELD_PRIME = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');

/**
 * Hash a string to a field element
 * 
 * Algorithm:
 * 1. SHA-256 hash the UTF-8 encoded string
 * 2. Convert hash to BigInt
 * 3. Modulo by FIELD_PRIME
 * 
 * This MUST match the extension's hashToField() implementation exactly.
 * 
 * @param str - String to hash
 * @returns Field element as string
 */
export function hashToField(str: string): string {
  const hash = crypto.createHash('sha256').update(str, 'utf8').digest();
  
  let num = BigInt(0);
  for (let i = 0; i < hash.length; i++) {
    const byte = hash[i];
    if (byte !== undefined) {
      num = (num << BigInt(8)) | BigInt(byte);
    }
  }
  
  const fieldElement = num % FIELD_PRIME;
  return fieldElement.toString();
}

/**
 * Hash an array of strings to field elements
 * 
 * @param strings - Array of strings to hash
 * @returns Array of field elements as strings
 */
export function hashStringsToField(strings: string[]): string[] {
  return strings.map(hashToField);
}

/**
 * Hash and pad an array to size 10 (for set_membership circuit)
 * 
 * @param strings - Array of strings to hash (max 10)
 * @returns Array of exactly 10 field elements (padded with "0")
 */
export function hashAndPadSet(strings: string[]): string[] {
  if (strings.length > 10) {
    throw new Error('Set size exceeds maximum of 10 elements');
  }
  
  const hashed = hashStringsToField(strings);
  
  // Pad to 10 elements
  while (hashed.length < 10) {
    hashed.push('0');
  }
  
  return hashed;
}
