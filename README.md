# Treino

PWA pessoal para registrar treinos de musculação. pt-BR, cargas em kg, offline, dados só no aparelho (IndexedDB/Dexie).

## Desenvolvimento

```
npm install
npm run dev        # servidor local
npm run build      # gera dist/
npm run preview    # serve dist/ (testa o service worker)
```

## Dados de exercícios (Free Exercise DB — Unlicense)

Pipeline reproduzível (não edite `src/data/*.json` à mão):

| Script | O que faz |
|---|---|
| `npm run data:fetch` | baixa `data/raw/exercises.json` |
| `npm run data:filter` | filtra categorias strength/powerlifting e equipamentos de academia → `data/filtered.json` |
| `npm run data:translate` | aplica `data/i18n/names-*.json` + `terms.json` → `src/data/exercises.json` |
| `npm run data:images` | baixa imagens e converte para WebP (400px, q75) → `public/img/ex/` |
| `npm run icons` | gera os ícones em `public/icons/` |

Para corrigir um nome em português, edite o `data/i18n/names-NN.json` correspondente e rode `npm run data:translate`.

Variações do mesmo movimento são agrupadas por regras sobre o nome em pt-BR (`src/groups.js`). As mesmas regras
valem para exercícios personalizados (ex: "Supino reto na máquina X" entra em "Supino reto"). Depois de mudar as
regras, rode `npm run data:translate`.

## Banco de dados — regra permanente

Nenhuma atualização pode apagar ou corromper dados dos usuários. Toda mudança de schema é uma nova
`db.version(N)` em `src/db.js`, com `.upgrade()` quando houver transformação. Versões publicadas nunca são editadas.

## Deploy

GitHub Pages via `.github/workflows/deploy.yml` (push em `main`). Em Settings → Pages, escolha "GitHub Actions" como fonte.
`base: './'` + `HashRouter` permitem publicar em qualquer subcaminho.
