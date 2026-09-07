#!/usr/bin/env node
// Registro de desempenho das delegações.
//
// Toda tarefa entregue a um modelo mais barato vira uma linha aqui. Com amostra
// suficiente, a atribuição de `ROTEAMENTO.md` deixa de ser palpite e passa a ser
// medida — inclusive para descobrir que um modelo mais barato dá conta, ou que
// um mais caro é necessário.
//
//   node .agent/registro.mjs add '{"tarefa":"...","tipo":"...","modelo":"haiku","resultado":"acerto"}'
//   node .agent/registro.mjs relatorio

import { appendFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const ARQUIVO = resolve(ROOT, '.agent', 'registro.jsonl');

const RESULTADOS = ['acerto', 'acerto-com-correcao', 'erro'];

function adicionar(json) {
  const entrada = JSON.parse(json);
  for (const campo of ['tarefa', 'tipo', 'modelo', 'resultado']) {
    if (!entrada[campo]) throw new Error(`campo obrigatorio ausente: ${campo}`);
  }
  if (!RESULTADOS.includes(entrada.resultado)) {
    throw new Error(`resultado deve ser um de: ${RESULTADOS.join(', ')}`);
  }
  const linha = {
    data: new Date().toISOString(),
    tentativas: 1,
    correcoes: 0,
    ...entrada,
  };
  appendFileSync(ARQUIVO, JSON.stringify(linha) + '\n', 'utf8');
  console.log(`registrado: ${linha.modelo} / ${linha.tipo} / ${linha.resultado}`);
}

function ler() {
  if (!existsSync(ARQUIVO)) return [];
  return readFileSync(ARQUIVO, 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}

// Uma correção pontual não invalida a delegação; erro invalida. O peso reflete
// isso: acerto vale 1, acerto que precisou de retoque vale meio, erro vale 0.
const PESO = { acerto: 1, 'acerto-com-correcao': 0.5, erro: 0 };

function relatorio() {
  const linhas = ler();
  if (linhas.length === 0) {
    console.log('nenhuma delegacao registrada ainda');
    return;
  }

  const grupos = new Map();
  for (const l of linhas) {
    const chave = `${l.modelo} / ${l.tipo}`;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(l);
  }

  console.log(`${linhas.length} delegacoes registradas\n`);
  console.log('modelo / tipo de acao                     n   acerto   veredito');
  console.log('-'.repeat(70));

  for (const [chave, itens] of [...grupos.entries()].sort()) {
    const taxa = itens.reduce((s, i) => s + PESO[i.resultado], 0) / itens.length;
    const pct = Math.round(taxa * 100);

    let veredito = 'amostra pequena';
    if (itens.length >= 5) {
      if (pct < 60) veredito = 'SUBIR de modelo';
      else if (pct >= 90 && itens.length >= 8) veredito = 'tentar modelo mais barato';
      else veredito = 'manter';
    }

    console.log(`${chave.padEnd(40)} ${String(itens.length).padStart(2)}  ${String(pct).padStart(5)}%   ${veredito}`);
  }

  const erros = linhas.filter((l) => l.resultado === 'erro');
  if (erros.length > 0) {
    console.log(`\nfalhas (${erros.length}):`);
    for (const e of erros.slice(-8)) console.log(`  ${e.modelo}: ${e.tarefa} — ${e.nota ?? 'sem nota'}`);
  }
}

const comando = process.argv[2];
if (comando === 'add') adicionar(process.argv[3]);
else if (comando === 'relatorio') relatorio();
else {
  console.error('uso: node .agent/registro.mjs add \'<json>\' | relatorio');
  process.exit(2);
}
