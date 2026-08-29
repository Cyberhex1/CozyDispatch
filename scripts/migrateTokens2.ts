import fs from 'fs';
import path from 'path';

const SRC_DIR = path.join(process.cwd(), 'src');

const colorMap: Record<string, string> = {
  // Catch standard Tailwind colors that missed the hex replacement
  'bg-white': 'bg-base',
  'hover:bg-white': 'hover:bg-surface',
  'text-black': 'text-text-main',
  'bg-[#5A5A40]': 'bg-inverse',
};

function walkDir(dir: string, callback: (filepath: string) => void) {
  fs.readdirSync(dir).forEach((f) => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

let filesModified = 0;

walkDir(SRC_DIR, (filepath) => {
  if (filepath.endsWith('.tsx') || filepath.endsWith('.ts')) {
    let content = fs.readFileSync(filepath, 'utf8');
    let modified = false;

    // Use a negative lookahead/lookbehind to ensure we don't replace
    // 'bg-white' if it's part of another string like 'text-bg-white' (not a thing, but safe)
    // Actually simple split/join on word boundaries is safer.

    // Let's use regex with word boundaries
    for (const [oldClass, newClass] of Object.entries(colorMap)) {
      // Escape brackets if needed
      const safeOldClass = oldClass.replace(/\[/g, '\\[').replace(/\]/g, '\\]');
      const regex = new RegExp(`(?<!-)${safeOldClass}(?!-)`, 'g');
      
      if (regex.test(content)) {
        content = content.replace(regex, newClass);
        modified = true;
      }
    }

    if (modified) {
      fs.writeFileSync(filepath, content, 'utf8');
      filesModified++;
      console.log(`Updated: ${path.basename(filepath)}`);
    }
  }
});

console.log(`\nSecondary migration complete! Updated ${filesModified} files.`);
