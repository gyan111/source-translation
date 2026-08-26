import fs from 'fs';
import path from 'path';

const fontDir = path.resolve('public/fonts');
if (!fs.existsSync(fontDir)) {
  fs.mkdirSync(fontDir, { recursive: true });
}

async function main() {
  const cssRes = await fetch('https://fonts.googleapis.com/icon?family=Material+Icons+Round', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  const cssText = await cssRes.text();
  console.log('Fetched CSS:\n', cssText);

  const match = cssText.match(/url\((https:\/\/[^)]+)\)/);
  if (!match) {
    throw new Error('Could not find font URL in CSS: ' + cssText);
  }

  const fontUrl = match[1];
  console.log('Downloading font from:', fontUrl);

  const fontRes = await fetch(fontUrl);
  const buffer = Buffer.from(await fontRes.arrayBuffer());

  const targetPath = path.join(fontDir, 'material-icons-round.woff2');
  fs.writeFileSync(targetPath, buffer);
  console.log(`Saved ${buffer.length} bytes to ${targetPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
