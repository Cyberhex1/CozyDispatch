import fs from 'fs';
import path from 'path';

const SRC_DIR = path.join(process.cwd(), 'src');

const colorMap: Record<string, string> = {
  // Backgrounds
  'bg-[#FDFBF7]': 'bg-base',
  'bg-[#F5F5F0]': 'bg-surface',
  'bg-[#EBF0EA]': 'bg-surface-brand',
  
  // Borders
  'border-[#E6E2D3]': 'border-border',
  'border-[#D6D2C4]': 'border-border-hover',
  'border-[#8BA888]/30': 'border-brand/30',
  'border-[#8BA888]/40': 'border-brand/40',
  'border-[#8BA888]/50': 'border-brand/50',
  'border-[#8BA888]': 'border-brand',
  
  // Text
  'text-[#4A4A40]': 'text-text-main',
  'text-[#5A5A40]': 'text-text-heading',
  'text-[#707060]': 'text-text-muted',
  'text-[#A0A090]': 'text-text-faint',
  'text-[#888870]': 'text-text-alt',
  
  // Brand / Accents
  'bg-[#8BA888]': 'bg-brand',
  'hover:bg-[#7A9977]': 'hover:bg-brand-hover',
  'text-[#8BA888]': 'text-brand',
  'hover:text-[#8BA888]': 'hover:text-brand',
  'hover:text-[#7A9977]': 'hover:text-brand-hover',
  
  'bg-[#E6A07D]': 'bg-accent',
  'hover:bg-[#D98A65]': 'hover:bg-accent-hover',
  'text-[#E6A07D]': 'text-accent',
  'hover:text-[#E6A07D]': 'hover:text-accent',
  
  'bg-[#2C2C24]': 'bg-inverse',
  'text-[#FDFBF7]': 'text-inverse',
  
  // Hover Backgrounds (subtle)
  'hover:bg-[#F5F5F0]': 'hover:bg-surface',
  'hover:bg-[#E6E2D3]': 'hover:bg-border',
  
  // Hover Text
  'hover:text-[#5A5A40]': 'hover:text-text-heading',
  'hover:text-[#4A4A40]': 'hover:text-text-main',
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

    for (const [hex, semantic] of Object.entries(colorMap)) {
      // Create a regex to match the hex color string exactly (global replacement)
      const regex = new RegExp(hex.replace(/\[/g, '\\[').replace(/\]/g, '\\]'), 'g');
      if (regex.test(content)) {
        content = content.replace(regex, semantic);
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

console.log(`\nMigration complete! Updated ${filesModified} files.`);
