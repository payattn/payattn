/**
 * Dummy Ad Data for Demo
 * Matches database schema exactly with UUID primary keys
 * Realistic ad campaigns with variety for testing Max's decision-making
 */

/**
 * Generate a UUID v4
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Generate dummy ads for demo
 * Randomly selects 5-15 ads from a pool of 25
 */
function generateDummyAds() {
  console.log('[Dummy Ads] Generating ads from expanded pool...');
  // Temporarily return empty array - full implementation in next command
  return [];
}

// Export
if (typeof window !== 'undefined') {
  window.generateDummyAds = generateDummyAds;
}
