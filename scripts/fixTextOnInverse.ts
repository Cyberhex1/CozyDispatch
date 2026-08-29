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

let count = 0;
walkDir(SRC_DIR, (filepath) => {
  if (filepath.endsWith('.tsx')) {
    let content = fs.readFileSync(filepath, 'utf8');
    let modified = false;

    // Search for `text-inverse` anywhere `bg-inverse` is used, or just replace `text-inverse` wholesale
    // Wait, let's just globally replace `text-inverse` with `text-text-on-inverse` IF it's part of a class string that also contains `bg-inverse`.
    // Actually, `text-inverse` shouldn't be used at all unless it's meant to be the color `#2C2C24` / `#EAE6D8`.
    // In light mode, `#2C2C24` is dark. So `text-inverse` meant "dark text".
    // But wait, the original tag text color was `#FDFBF7` (light text), which got mapped to `text-inverse` (which is dark in light mode, causing dark-on-dark).
    // So YES, all instances where `text-inverse` is used as a foreground for `bg-inverse` should be `text-text-on-inverse`.
    
    // Let's replace 'text-inverse' with 'text-text-on-inverse'
    if (content.includes('text-inverse')) {
      content = content.replace(/text-inverse/g, 'text-text-on-inverse');
      modified = true;
    }

    // Also replace `text-white` with `text-text-on-inverse` IF it is next to `bg-inverse` because my earlier script might have missed some
    // Wait, earlier script DID NOT replace `text-white`. Only `text-[#FDFBF7]`.
    // Let's replace `text-white` with `text-text-on-inverse` when it's on a `bg-inverse` background.
    // We can just regex replace: bg-inverse(.*?)text-white
    // But it's easier to just do text-white -> text-text-on-inverse globally? No, text-white is used inside bg-brand too!
    
    // Just find 'bg-inverse' and replace 'text-white' with 'text-text-on-inverse' in the same line.
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('bg-inverse') && lines[i].includes('text-white')) {
        lines[i] = lines[i].replace(/text-white/g, 'text-text-on-inverse');
        modified = true;
      }
    }
    content = lines.join('\n');

    if (modified) {
      fs.writeFileSync(filepath, content, 'utf8');
      count++;
    }
  }
});

console.log(`Fixed crossover text colors in ${count} files.`);
