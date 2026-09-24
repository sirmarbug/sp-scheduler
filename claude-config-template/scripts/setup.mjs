#!/usr/bin/env node
// Bootstrapuje projekt z tego szablonu: pyta o nazwę i stacki, podmienia
// placeholdery, doklejaz snippety, kopiuje skille i sprząta po sobie.

import * as rl from "node:readline/promises";
import { stdin, stdout } from "node:process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";

const info = (msg) => console.log(`${CYAN}ℹ${RESET} ${msg}`);
const success = (msg) => console.log(`${GREEN}✔${RESET} ${msg}`);
const warn = (msg) => console.log(`${YELLOW}⚠${RESET} ${msg}`);
const error = (msg) => console.log(`${RED}✘${RESET} ${msg}`);
const heading = (msg) => console.log(`\n${BOLD}${msg}${RESET}`);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const STACKS = [
  { id: "1", key: "vue", label: "Vue" },
  { id: "2", key: "react", label: "React" },
  { id: "3", key: "express", label: "Express" },
  { id: "4", key: "react-native", label: "React Native" },
];

const TEXT_FILES_TO_REPLACE = ["CLAUDE.md", "package.json", "README.md"];
const STACK_SNIPPET_MARKER = "<!-- STACK_SNIPPETS_HERE -->";

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function askProjectName(rlInterface) {
  while (true) {
    const answer = (await rlInterface.question("Nazwa projektu: ")).trim();
    if (answer.length > 0) {
      return answer;
    }
    error("Nazwa projektu nie może być pusta. Spróbuj ponownie.");
  }
}

function parseStackSelection(raw) {
  const tokens = raw
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const selected = [];
  const invalid = [];

  for (const token of tokens) {
    const match = STACKS.find((s) => s.id === token);
    if (match) {
      if (!selected.includes(match)) {
        selected.push(match);
      }
    } else {
      invalid.push(token);
    }
  }

  return { selected, invalid };
}

async function askStacks(rlInterface) {
  console.log("\nDostępne stacki:");
  for (const stack of STACKS) {
    console.log(`  ${stack.id}) ${stack.label}`);
  }

  while (true) {
    const raw = (
      await rlInterface.question(
        "Które stacki dołączyć? (numery po przecinku, np. 1,3, Enter = żaden): "
      )
    ).trim();

    if (raw.length === 0) {
      return [];
    }

    const { selected, invalid } = parseStackSelection(raw);

    if (invalid.length > 0) {
      error(`Nieznane numery: ${invalid.join(", ")}. Użyj wartości 1-4.`);
      continue;
    }

    return selected;
  }
}

async function replacePlaceholderInFile(filePath, projectName) {
  if (!(await pathExists(filePath))) {
    return false;
  }
  const content = await fs.readFile(filePath, "utf8");
  if (!content.includes("{{PROJECT_NAME}}")) {
    return false;
  }
  const replaced = content.replaceAll("{{PROJECT_NAME}}", projectName);
  await fs.writeFile(filePath, replaced, "utf8");
  return true;
}

async function insertStackSnippets(claudeMdPath, selectedStacks) {
  const content = await fs.readFile(claudeMdPath, "utf8");

  if (!content.includes(STACK_SNIPPET_MARKER)) {
    warn(
      `Nie znaleziono znacznika ${STACK_SNIPPET_MARKER} w CLAUDE.md — pomijam wstawianie snippetów.`
    );
    return;
  }

  if (selectedStacks.length === 0) {
    const cleaned = content.replace(STACK_SNIPPET_MARKER, "");
    await fs.writeFile(claudeMdPath, cleaned, "utf8");
    return;
  }

  const snippets = [];
  for (const stack of selectedStacks) {
    const snippetPath = path.join(
      ROOT,
      "stacks",
      stack.key,
      "CLAUDE.snippet.md"
    );
    if (!(await pathExists(snippetPath))) {
      warn(`Brak pliku snippetu dla stacku "${stack.label}" (${snippetPath}) — pomijam.`);
      continue;
    }
    const snippetContent = (await fs.readFile(snippetPath, "utf8")).trim();
    snippets.push(snippetContent);
  }

  const combined = snippets.join("\n\n---\n\n");
  const updated = content.replace(STACK_SNIPPET_MARKER, combined);
  await fs.writeFile(claudeMdPath, updated, "utf8");
}

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function copySkills(selectedStacks) {
  const skillsDest = path.join(ROOT, ".claude", "skills");
  await fs.mkdir(skillsDest, { recursive: true });

  const sharedSkillsDir = path.join(ROOT, "shared-skills");
  if (await pathExists(sharedSkillsDir)) {
    const entries = await fs.readdir(sharedSkillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const src = path.join(sharedSkillsDir, entry.name);
      const dest = path.join(skillsDest, entry.name);
      await copyDir(src, dest);
      success(`Skopiowano wspólny skill: ${entry.name}`);
    }
  }

  for (const stack of selectedStacks) {
    const stackSkillsDir = path.join(ROOT, "stacks", stack.key, "skills");
    if (!(await pathExists(stackSkillsDir))) {
      continue;
    }
    const entries = await fs.readdir(stackSkillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const src = path.join(stackSkillsDir, entry.name);
      const dest = path.join(skillsDest, entry.name);
      await copyDir(src, dest);
      success(`Skopiowano skill "${entry.name}" dla stacku ${stack.label}`);
    }
  }
}

async function removePath(targetPath) {
  if (await pathExists(targetPath)) {
    await fs.rm(targetPath, { recursive: true, force: true });
    return true;
  }
  return false;
}

async function selfCleanup() {
  const stacksDir = path.join(ROOT, "stacks");
  const sharedSkillsDir = path.join(ROOT, "shared-skills");

  if (await removePath(stacksDir)) {
    success("Usunięto katalog stacks/");
  }
  if (await removePath(sharedSkillsDir)) {
    success("Usunięto katalog shared-skills/");
  }

  success("Usuwam scripts/setup.mjs...");
  await fs.rm(__filename, { force: true });

  const scriptsDir = path.dirname(__filename);
  try {
    const remaining = await fs.readdir(scriptsDir);
    if (remaining.length === 0) {
      await fs.rmdir(scriptsDir);
    }
  } catch {
    // katalog może już nie istnieć lub nie być pusty — nieistotne
  }
}

async function main() {
  heading("Setup projektu z szablonu Claude Code");

  const rlInterface = rl.createInterface({ input: stdin, output: stdout });

  let projectName;
  let selectedStacks;
  try {
    projectName = await askProjectName(rlInterface);
    selectedStacks = await askStacks(rlInterface);
  } finally {
    rlInterface.close();
  }

  heading("Podmieniam {{PROJECT_NAME}}...");
  for (const relPath of TEXT_FILES_TO_REPLACE) {
    const fullPath = path.join(ROOT, relPath);
    const replaced = await replacePlaceholderInFile(fullPath, projectName);
    if (replaced) {
      success(`Podmieniono nazwę projektu w ${relPath}`);
    } else {
      warn(`Nie podmieniono nazwy w ${relPath} (plik nie istnieje lub brak placeholdera)`);
    }
  }

  heading("Wstawiam snippety stackowe do CLAUDE.md...");
  await insertStackSnippets(path.join(ROOT, "CLAUDE.md"), selectedStacks);
  if (selectedStacks.length > 0) {
    success(
      `Dodano snippety dla: ${selectedStacks.map((s) => s.label).join(", ")}`
    );
  } else {
    info("Nie wybrano żadnego stacku — znacznik usunięty bez treści.");
  }

  heading("Kopiuję skille do .claude/skills/...");
  await copySkills(selectedStacks);

  heading("Sprzątanie...");
  await selfCleanup();

  heading("Gotowe!");
  console.log(`Projekt "${projectName}" został skonfigurowany.\n`);
  console.log("Co zostało zrobione:");
  console.log(`  - Podmieniono {{PROJECT_NAME}} na "${projectName}"`);
  console.log(
    `  - Dołączono konwencje dla: ${
      selectedStacks.length > 0 ? selectedStacks.map((s) => s.label).join(", ") : "(brak)"
    }`
  );
  console.log("  - Skille skopiowane do .claude/skills/");
  console.log("  - Usunięto katalogi stacks/, shared-skills/ oraz scripts/setup.mjs");

  console.log("\nSugerowane kolejne kroki:");
  console.log("  1. Uzupełnij wszystkie znaczniki `<!-- TODO: uzupełnij -->` w CLAUDE.md, docs/architecture.md i .claude/skills/*/SKILL.md");
  console.log("  2. Uruchom `git init` i zrób pierwszy commit");
  console.log("  3. Sprawdź .claude/settings.json i dostosuj permissions do swojego projektu");
}

main().catch((err) => {
  error(`Nieoczekiwany błąd: ${err.message}`);
  process.exitCode = 1;
});
