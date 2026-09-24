# claude-config-template

Repozytorium-szablon do szybkiego bootstrapowania nowych projektów z gotową
konfiguracją Claude Code (CLAUDE.md, hooki, skille dla różnych stacków).

## Jak zacząć

### Opcja 1: GitHub template

1. Kliknij przycisk **"Use this template"** na stronie tego repozytorium na
   GitHubie i utwórz nowe repo na jego podstawie.
2. Sklonuj nowo utworzone repo lokalnie.

### Opcja 2: npx degit

```bash
npx degit <org>/claude-config-template {{PROJECT_NAME}}
cd {{PROJECT_NAME}}
```

### Setup

Po skopiowaniu repo uruchom:

```bash
npm run setup
```

Skrypt zapyta o nazwę projektu oraz stacki technologiczne do dołączenia
(Vue / React / Express / React Native), a następnie:

- podmieni `{{PROJECT_NAME}}` w plikach projektu,
- doklei konwencje wybranych stacków do `CLAUDE.md`,
- skopiuje odpowiednie skille do `.claude/skills/`,
- posprząta katalogi `stacks/`, `shared-skills/` i sam siebie.

### Po setupie

1. Uzupełnij wszystkie znaczniki `<!-- TODO: uzupełnij -->` w:
   - `CLAUDE.md`
   - `docs/architecture.md`
   - `.claude/skills/*/SKILL.md`
2. Zrób `git init` i pierwszy commit.
