const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectDir = path.dirname(__dirname);
const crawlerPath = path.join(projectDir, 'scripts', 'crawler.js');

function runCommand(command, cwd = process.cwd()) {
  try {
    execSync(command, { stdio: 'inherit', cwd });
    return true;
  } catch (error) {
    return false;
  }
}

async function main() {
  console.log('====================================================');
  console.log('  🚀 WP LOCAL-TO-STATIC CROSS-PLATFORM PUBLISHER   ');
  console.log('====================================================\n');

  // 1. Run the crawler
  console.log('[1/4] Running Static Crawler...');
  const crawlSuccess = runCommand(`node "${crawlerPath}"`);
  if (!crawlSuccess) {
    console.error('\n❌ [ERROR] Static crawl failed. Publishing aborted.\n');
    process.exit(1);
  }

  // 2. Stage files
  console.log('\n[2/4] Staging modified pages and assets...');
  const stageSuccess = runCommand('git add .');
  if (!stageSuccess) {
    console.error('\n❌ [ERROR] Failed to stage files with Git.\n');
    process.exit(1);
  }

  // 3. Commit changes
  console.log('\n[3/4] Creating static release commit...');
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const commitSuccess = runCommand(`git commit -m "Publish: Automatic static site update - ${timestamp}"`);
  if (!commitSuccess) {
    console.log('ℹ️ No changes detected. Nothing to commit.');
  }

  // 4. Push to GitHub
  console.log('\n[4/4] Pushing code to GitHub...');
  const pushSuccess = runCommand('git push origin main');
  if (!pushSuccess) {
    console.error('\n❌ [ERROR] Git push failed. Please check your credentials and repository.\n');
    process.exit(1);
  }

  console.log('\n====================================================');
  console.log('  🎉 SUCCESS: Static website successfully deployed!  ');
  console.log('====================================================\n');
}

main().catch(err => {
  console.error('Fatal error during publishing execution:', err);
  process.exit(1);
});
