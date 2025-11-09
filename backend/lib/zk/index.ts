/**
 * ZK-SNARK Library - Main Entry Point
 * 
 * Aggregates all ZK utilities for easy importing throughout the project
 */

// Export circuit registry and utilities
export * from './circuits-registry';

// Export witness generation utilities
export * from './witness';

// Export proof generation
export * from './prover';

// Export verification
export * from './verifier';
