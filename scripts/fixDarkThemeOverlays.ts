import fs from 'fs';
import path from 'path';

const SRC_DIR = path.join(process.cwd(), 'src');

function walkDir(dir: string, callback: (filepath: string) => void) {
  fs.readdirSync(dir).forEach((f) => {
    const dirPath = path.join(dir, f);
    if (fs.statSync(dirPath).isDirectory()) {
      walkDir(dirPath, callback);
    } else {
      callback(dirPath);
    }
  });
}

const replacements: Array<[RegExp | string, string]> = [
  // Gradient overlays that were hardcoded to white/light hex
  ['from-white via-white/90 to-[#FDFBF7]/80', 'from-base via-base/90 to-base/80'],
  ['from-white via-white/40 to-transparent', 'from-base via-base/40 to-transparent'],
  ['from-[#FDFBF7] via-[#FDFBF7]/40 to-transparent', 'from-base via-base/40 to-transparent'],
  ['from-[#EBF0EA] via-[#F5F5F0] to-[#FDFBF7]', 'from-surface-brand via-surface to-base'],
  
  // Remaining light hex backgrounds & borders
  ['bg-[#FAF9F5]', 'bg-surface'],
  ['bg-[#FDFBF7]', 'bg-base'],
  ['border-[#F5F5F0]', 'border-border'],
  ['border-[#E6E2D3]', 'border-border'],
  ['border-[#D6D2C4]', 'border-border-hover'],
  ['bg-[#E6E2D3]', 'bg-border'],
  
  // Card backgrounds: make sure game cards and article cards use bg-surface
  ['group bg-base rounded-2xl', 'group bg-surface rounded-2xl'],
  ['group bg-base rounded-3xl', 'group bg-surface rounded-3xl'],
  ['aspect-[16/10] bg-surface', 'aspect-[16/10] bg-base'],
  ['aspect-[16/9] bg-surface', 'aspect-[16/9] bg-base'],
  ['hover:bg-[#4A4A40]', 'hover:bg-inverse/80'],
  ['hover:bg-[#4A6B47]', 'hover:bg-brand-hover'],
  ['hover:bg-[#7A9977]', 'hover:bg-brand-hover'],
  ['bg-[#7A9977]', 'bg-brand-hover'],
];

let count = 0;
walkDir(SRC_DIR, (filepath) => {
  if (filepath.endsWith('.tsx') || filepath.endsWith('.ts')) {
    let content = fs.readFileSync(filepath, 'utf8');
    let modified = false;

    for (const [from, to] of replacements) {
      if (typeof from === 'string') {
        if (content.includes(from)) {
          content = content.replaceAll(from, to);
          modified = true;
        }
      } else {
        if (from.test(content)) {
          content = content.replace(from, to);
          modified = true;
        }
      }
    }

    if (modified) {
      fs.writeFileSync(filepath, content, 'utf8');
      console.log(`Patched: ${path.basename(filepath)}`);
      count++;
    }
  }
});

console.log(`\nSuccessfully patched ${count} files with proper dark/light theme gradients and card surfaces!`);
