#!/usr/bin/env node
const dryRun = process.argv.includes('--dry-run');
const targetIndex = process.argv.indexOf('--target');
const target = targetIndex >= 0 ? process.argv[targetIndex + 1] : 'vercel';

if (dryRun) {
  console.log(JSON.stringify({
    target,
    shareUrl: `https://preview.omnicore.dev/${target}/dry-run`,
    steps: ['build', 'compress-assets', 'upload-cdn']
  }));
}
