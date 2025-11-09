/**
 * Save witness calculator builder to window
 * Must be loaded immediately after witness_calculator.js
 */

// Save the witness calculator builder before other scripts overwrite module.exports
if (window.module && window.module.exports) {
  window.witnessCalculatorBuilder = window.module.exports;
  console.log('[Extension] Witness calculator builder saved:', typeof window.witnessCalculatorBuilder);
} else {
  console.error('[Extension] witness_calculator.js did not set module.exports!');
}
