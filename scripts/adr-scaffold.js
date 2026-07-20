#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ADR_DIR = path.join(__dirname, '../docs/adr');
const TEMPLATE_PATH = path.join(ADR_DIR, '0000-template.md');

// Ensure ADR directory exists
if (!fs.existsSync(ADR_DIR)) {
  fs.mkdirSync(ADR_DIR, { recursive: true });
}

// Read template
if (!fs.existsSync(TEMPLATE_PATH)) {
  console.error('Template file not found at:', TEMPLATE_PATH);
  process.exit(1);
}

const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');

// Get next ADR number
const existingFiles = fs.readdirSync(ADR_DIR);
const adrNumbers = existingFiles
  .filter(f => /^\d{4}-/.test(f))
  .map(f => parseInt(f.substring(0, 4)))
  .filter(n => !isNaN(n));

const nextNumber = (Math.max(...adrNumbers, -1) + 1).toString().padStart(4, '0');

// Prompt for title
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question(`Enter ADR title (will be formatted as ${nextNumber}-title-slug.md): `, (title) => {
  rl.close();

  if (!title.trim()) {
    console.error('Title cannot be empty.');
    process.exit(1);
  }

  // Convert title to slug
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const filename = `${nextNumber}-${slug}.md`;
  const filepath = path.join(ADR_DIR, filename);

  if (fs.existsSync(filepath)) {
    console.error(`File already exists: ${filename}`);
    process.exit(1);
  }

  // Create new ADR from template
  const today = new Date().toISOString().split('T')[0];
  const content = template
    .replace('0000', nextNumber)
    .replace(/title/i, title)
    .replace(/YYYY-MM-DD/, today)
    .replace(/Proposed \| Accepted \| Superseded \| Deprecated/, 'Proposed');

  fs.writeFileSync(filepath, content, 'utf8');

  console.log(`✓ Created: ${filepath}`);
  console.log(`\nEdit the file and update the sections as needed.`);
});
