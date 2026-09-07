#!/usr/bin/env node
// Orquestrador local: entrega uma spec ao modelo do Ollama, aplica o que ele
// devolve, roda a validacao e devolve o erro para ele tentar de novo.
// Uso: node .agent/run.mjs .agent/tasks/<spec>.md

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, cpSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
// OLLAMA_HOST costuma vir sem esquema (ex.: "0.0.0.0:11434"), que fetch nao aceita
function ollamaBase() {
  const raw = (process.env.OLLAMA_HOST ?? '127.0.0.1:11434').trim();
  const withScheme = /^https?:\/\//.test(raw) ? raw : `http://${raw}`;
  return withScheme.replace('//0.0.0.0', '//127.0.0.1').replace(/\/+$/, '');
}

const OLLAMA = ollamaBase();
const BACKUP = join(ROOT, '.agent', '.backup');

const specPath = process.argv[2];
if (!specPath) {
  console.error('uso: node .agent/run.mjs <spec.md>');
  process.exit(2);
}

const SYSTEM = [
  'Voce edita um projeto TypeScript + React + Vite.',
  '',
  'REGRAS DE SAIDA - obrigatorias:',
  '- Responda APENAS com blocos de arquivo. Nada antes, nada depois, nenhuma explicacao.',
  '- Um bloco por arquivo, exatamente neste formato:',
  '<<<FILE caminho/relativo/do/arquivo.tsx',
  'conteudo completo do arquivo',
  '>>>END',
  '- Escreva o arquivo INTEIRO, do primeiro ao ultimo caractere. Nunca use reticencias,',
  '  "resto igual", comentarios de omissao ou diffs.',
  '- Nao use cercas de markdown.',
  '- Edite somente os arquivos listados em ARQUIVOS AUTORIZADOS.',
  '- O codigo precisa compilar em TypeScript strict, com noUnusedLocals e noUnusedParameters ligados.',
  '- Textos visiveis ao usuario ficam em portugues do Brasil, com acentuacao correta.',
].join('\n');

// ---------- spec ----------
function parseSpec(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) throw new Error('spec precisa comecar com frontmatter entre ---');
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: m[2].trim() };
}

const list = (v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);
const trunc = (s, n) => (s.length > n ? s.slice(0, n) + '\n[...truncado]' : s);

const { meta, body } = parseSpec(readFileSync(specPath, 'utf8'));
const model = process.env.AGENT_MODEL ?? meta.model ?? 'qwen3-coder:30b';
const context = list(meta.context);
const allow = list(meta.allow);
const verifyCmd = meta.verify ?? 'npm run build';
const maxAttempts = Number(meta.attempts ?? 3);
const numCtx = Number(meta.num_ctx ?? 32768);

if (allow.length === 0) throw new Error('spec precisa declarar "allow" com os arquivos editaveis');

// ---------- prompt ----------
function fileSection(paths) {
  return paths
    .map((p) => {
      const abs = join(ROOT, p);
      const content = existsSync(abs) ? readFileSync(abs, 'utf8') : '(arquivo ainda nao existe)';
      return `### ARQUIVO ATUAL: ${p}\n${content}`;
    })
    .join('\n\n');
}

const userPrompt = `${body}

## ARQUIVOS AUTORIZADOS (somente estes podem ser escritos)
${allow.map((p) => `- ${p}`).join('\n')}

## CONTEXTO DO PROJETO
${fileSection([...new Set([...context, ...allow])])}`;

// ---------- ollama ----------
// Streaming e obrigatorio aqui: sem ele o fetch estoura o timeout de headers
// enquanto o Ollama carrega o modelo na VRAM.
async function ask(messages) {
  const res = await fetch(`${OLLAMA}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      options: { temperature: 0.1, num_ctx: numCtx },
    }),
  });
  if (!res.ok) throw new Error(`ollama ${res.status}: ${await res.text()}`);

  let text = '';
  let tokens = 0;
  let seconds = 0;
  let buffer = '';

  for await (const chunk of res.body) {
    buffer += Buffer.from(chunk).toString('utf8');
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      const data = JSON.parse(line);
      if (data.error) throw new Error(`ollama: ${data.error}`);
      text += data.message?.content ?? '';
      if (data.done) {
        tokens = data.eval_count ?? 0;
        seconds = Math.round((data.total_duration ?? 0) / 1e9);
      }
    }
    process.stderr.write(`\r  gerando... ${text.length} chars`);
  }
  process.stderr.write('\n');

  return { text, tokens, seconds };
}

// ---------- parsing ----------
const FENCE = '```';

function stripFences(raw) {
  const lines = raw.replace(/^\r?\n/, '').split(/\r?\n/);
  if (lines[0]?.trim().startsWith(FENCE)) lines.shift();
  while (lines.length && lines.at(-1).trim() === '') lines.pop();
  if (lines.at(-1)?.trim() === FENCE) lines.pop();
  return lines.join('\n') + '\n';
}

function parseFiles(text) {
  const out = [];
  const re = /^<<<FILE[ \t]+(.+?)[ \t]*\r?$([\s\S]*?)^>>>END[ \t]*\r?$/gm;
  let m;
  while ((m = re.exec(text))) out.push({ path: m[1].trim(), content: stripFences(m[2]) });
  return out;
}

const normalize = (p) => p.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');

// ---------- backup / rollback ----------
function backup(paths) {
  rmSync(BACKUP, { recursive: true, force: true });
  for (const p of paths) {
    const abs = join(ROOT, p);
    if (!existsSync(abs)) continue;
    const dest = join(BACKUP, p);
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(abs, dest);
  }
}

function restore(written) {
  for (const p of written) {
    const abs = join(ROOT, p);
    const src = join(BACKUP, p);
    if (existsSync(src)) cpSync(src, abs);
    else if (existsSync(abs)) rmSync(abs);
  }
}

// ---------- validacao ----------
function verify() {
  try {
    execSync(verifyCmd, { cwd: ROOT, stdio: 'pipe', encoding: 'utf8', timeout: 300000 });
    return { ok: true, output: '' };
  } catch (err) {
    return { ok: false, output: `${err.stdout ?? ''}\n${err.stderr ?? ''}`.trim() };
  }
}

// ---------- loop ----------
backup(allow);

const messages = [
  { role: 'system', content: SYSTEM },
  { role: 'user', content: userPrompt },
];

const report = { spec: specPath, model, status: 'falhou', attempts: [], written: [] };
let written = [];

for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  process.stderr.write(`[tentativa ${attempt}/${maxAttempts}] consultando ${model}...\n`);
  const answer = await ask(messages);
  const files = parseFiles(answer.text);

  const accepted = [];
  const rejected = [];
  for (const f of files) {
    const path = normalize(f.path);
    if (allow.includes(path)) accepted.push({ path, content: f.content });
    else rejected.push(path);
  }

  const step = {
    n: attempt,
    tokens: answer.tokens,
    seconds: answer.seconds,
    arquivos: accepted.map((f) => f.path),
    recusados: rejected,
  };

  if (accepted.length === 0) {
    step.erro = 'nenhum bloco <<<FILE valido na resposta';
    report.attempts.push(step);
    messages.splice(2);
    messages.push({ role: 'assistant', content: trunc(answer.text, 1500) });
    messages.push({
      role: 'user',
      content: 'Sua resposta nao continha nenhum bloco valido. Responda SOMENTE com blocos <<<FILE caminho ... >>>END, sem texto ao redor.',
    });
    continue;
  }

  restore(written); // desfaz a tentativa anterior antes de aplicar a nova
  written = [];
  for (const f of accepted) {
    const abs = join(ROOT, f.path);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, f.content, 'utf8');
    written.push(f.path);
  }

  const result = verify();
  step.validacao = result.ok ? 'passou' : 'falhou';
  report.attempts.push(step);

  if (result.ok) {
    report.status = 'ok';
    report.written = written;
    break;
  }

  step.erro = trunc(result.output, 800);
  messages.splice(2); // mantem apenas system + spec: o historico nao cresce
  messages.push({ role: 'assistant', content: answer.text });
  messages.push({
    role: 'user',
    content: `O comando "${verifyCmd}" falhou:\n\n${trunc(result.output, 3000)}\n\nCorrija e responda de novo apenas com os blocos <<<FILE dos arquivos que precisam mudar.`,
  });
}

if (report.status !== 'ok') {
  restore(written);
  report.written = [];
  report.observacao = 'todas as tentativas falharam; arquivos revertidos ao estado original';
}

writeFileSync(join(ROOT, '.agent', 'report.json'), JSON.stringify(report, null, 2));

// ---------- resumo curto: a unica coisa que o orquestrador remoto precisa ler ----------
const totals = report.attempts.reduce(
  (acc, s) => ({ tokens: acc.tokens + s.tokens, seconds: acc.seconds + s.seconds }),
  { tokens: 0, seconds: 0 },
);
console.log(`STATUS: ${report.status}`);
console.log(`modelo: ${model} | tentativas: ${report.attempts.length}`);
console.log(`geracao local: ${totals.tokens} tokens em ${totals.seconds}s`);
if (report.status === 'ok') {
  console.log(`arquivos: ${report.written.join(', ')}`);
} else {
  const erro = report.attempts.at(-1)?.erro ?? 'sem detalhe';
  console.log(`ultimo erro:\n${erro.split('\n').slice(0, 12).join('\n')}`);
}
