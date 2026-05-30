const fs = require('fs');
const path = require('path');
const readline = require('readline');

const projectDir = path.dirname(__dirname);
const configPath = path.join(projectDir, 'wp-static-config.json');
const templatePath = path.join(projectDir, 'wp-static-config.json.template');

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => rl.question(query, (ans) => {
    rl.close();
    resolve(ans.trim());
  }));
}

async function main() {
  console.clear();
  console.log('====================================================');
  console.log('  🛠️  WP LOCAL-TO-STATIC GENERATOR CONFIG SETUP      ');
  console.log('====================================================\n');
  console.log('This wizard will help you configure your dynamic environment variables.\n');

  // Load template or existing config as baseline
  let config = {
    localUrl: 'http://rayanazhari.local',
    productionUrl: 'https://www.rayanazhari.co.uk',
    outputPath: './public',
    vercelAnalytics: false
  };

  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      console.log('ℹ️ Found existing wp-static-config.json. Using as baseline.\n');
    } catch (e) {}
  } else if (fs.existsSync(templatePath)) {
    try {
      config = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
    } catch (e) {}
  }

  // Question 1: Local WP URL
  let localUrlInput = await askQuestion(`1. Enter your Local WP URL [Default: ${config.localUrl}]: `);
  if (!localUrlInput) {
    localUrlInput = config.localUrl;
  }
  // Standardize
  if (!localUrlInput.startsWith('http://') && !localUrlInput.startsWith('https://')) {
    localUrlInput = 'http://' + localUrlInput;
  }
  // Strip trailing slash
  if (localUrlInput.endsWith('/')) {
    localUrlInput = localUrlInput.slice(0, -1);
  }

  // Question 2: Production URL
  let productionUrlInput = await askQuestion(`2. Enter your Production live URL [Default: ${config.productionUrl}]: `);
  if (!productionUrlInput) {
    productionUrlInput = config.productionUrl;
  }
  if (!productionUrlInput.startsWith('http://') && !productionUrlInput.startsWith('https://')) {
    productionUrlInput = 'https://' + productionUrlInput;
  }
  if (productionUrlInput.endsWith('/')) {
    productionUrlInput = productionUrlInput.slice(0, -1);
  }

  // Question 3: Output path
  let outputPathInput = await askQuestion(`3. Enter target static output folder [Default: ${config.outputPath}]: `);
  if (!outputPathInput) {
    outputPathInput = config.outputPath;
  }

  // Question 4: Vercel Analytics
  let analyticsInput = await askQuestion(`4. Enable Vercel Web Analytics integration? (y/N): `);
  const vercelAnalytics = analyticsInput.toLowerCase() === 'y' || analyticsInput.toLowerCase() === 'yes';

  // Save new config
  const newConfig = {
    localUrl: localUrlInput,
    productionUrl: productionUrlInput,
    outputPath: outputPathInput,
    vercelAnalytics: vercelAnalytics
  };

  fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2), 'utf8');

  console.log('\n====================================================');
  console.log(' 🎉 CONFIGURATION SAVED SUCCESSFULLY!');
  console.log('====================================================');
  console.log(`Saved settings to: ${path.relative(process.cwd(), configPath)}`);
  console.log(`\n• Local Domain  : ${newConfig.localUrl}`);
  console.log(`• Prod Domain   : ${newConfig.productionUrl}`);
  console.log(`• Output Folder : ${newConfig.outputPath}`);
  console.log(`• Analytics     : ${newConfig.vercelAnalytics ? 'Enabled' : 'Disabled'}`);
  console.log('====================================================\n');
  console.log('Next steps:');
  console.log('  1. Turn on your Local WP app and Start the site.');
  console.log('  2. Run the crawler:    npm run crawl');
  console.log('  3. Publish to GitHub:  npm run publish\n');
}

main().catch(err => {
  console.error('Error during setup wizard execution:', err);
  process.exit(1);
});
