const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync('eslint-results.json', 'utf8'));

// Engine/vendored files to exclude (already ignored in eslint.config.mjs)
const enginePatterns = [
  'js/libs',
  'js/rmmz_',
  'js/plugins',
  'js/main.js',
  'js/plugins.js',
];

const autoral = [];
const engine = [];

data.forEach(file => {
  const fp = file.filePath.replace(/\\/g, '/');
  const isEngine = enginePatterns.some(p => fp.includes(p));
  if (isEngine) {
    engine.push(file);
  } else {
    autoral.push(file);
  }
});

console.log(`=== TOTAL FILES WITH VIOLATIONS: ${data.length} ===`);
console.log(`Autoral files: ${autoral.length}`);
console.log(`Engine/vendored files: ${engine.length}`);
console.log();

// Count by rule for autoral files only
const ruleCounts = {};
const ruleFiles = {};
autoral.forEach(f => {
  f.messages.forEach(m => {
    if (!m.ruleId) return;
    ruleCounts[m.ruleId] = (ruleCounts[m.ruleId] || 0) + 1;
    if (!ruleFiles[m.ruleId]) ruleFiles[m.ruleId] = [];
    ruleFiles[m.ruleId].push(f.filePath.replace(/\\/g, '/').replace('C:/Users/Vale/Documents/github/NytheraSide/', ''));
  });
});

// Sort rules by count descending
const sortedRules = Object.entries(ruleCounts).sort((a, b) => b[1] - a[1]);
console.log('=== RULE COUNTS (autoral files only) ===');
sortedRules.forEach(([rule, count]) => {
  console.log(`${count}\t${rule}`);
});
console.log(`TOTAL VIOLATIONS (autoral): ${Object.values(ruleCounts).reduce((a,b)=>a+b,0)}`);
console.log();

// For top rules, show files with counts
const topRules = sortedRules.slice(0, 8);
topRules.forEach(([rule, count]) => {
  const files = [...new Set(ruleFiles[rule])];
  console.log(`--- ${rule} (${count} violations, ${files.length} files) ---`);
  // Count per file
  const fileCounts = {};
  autoral.forEach(f => {
    const fp = f.filePath.replace(/\\/g, '/').replace('C:/Users/Vale/Documents/github/NytheraSide/', '');
    const cnt = f.messages.filter(m => m.ruleId === rule).length;
    if (cnt > 0) fileCounts[fp] = cnt;
  });
  Object.entries(fileCounts).sort((a,b) => b[1]-a[1]).forEach(([f, c]) => {
    console.log(`  ${c}\t${f}`);
  });
  console.log();
});
