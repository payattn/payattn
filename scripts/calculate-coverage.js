const fs = require('fs');

// Read coverage-summary.json
const coverageData = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

// Calculate coverage only for files that have been covered (not 0%)
let totalFunctions = 0;
let coveredFunctions = 0;
let totalLines = 0;
let coveredLines = 0;
let totalStatements = 0;
let coveredStatements = 0;
let totalBranches = 0;
let coveredBranches = 0;
let fileCount = 0;

for (const [filePath, data] of Object.entries(coverageData)) {
  if (filePath === 'total') continue;
  
  // Only include files that have some coverage or are tested
  if (data.lines.total > 0) {
    totalFunctions += data.functions.total;
    coveredFunctions += data.functions.covered;
    totalLines += data.lines.total;
    coveredLines += data.lines.covered;
    totalStatements += data.statements.total;
    coveredStatements += data.statements.covered;
    totalBranches += data.branches.total;
    coveredBranches += data.branches.covered;
    fileCount++;
  }
}

const result = {
  functions: totalFunctions > 0 ? ((coveredFunctions / totalFunctions) * 100).toFixed(2) : 0,
  lines: totalLines > 0 ? ((coveredLines / totalLines) * 100).toFixed(2) : 0,
  statements: totalStatements > 0 ? ((coveredStatements / totalStatements) * 100).toFixed(2) : 0,
  branches: totalBranches > 0 ? ((coveredBranches / totalBranches) * 100).toFixed(2) : 0,
  fileCount
};

console.log(JSON.stringify(result));
