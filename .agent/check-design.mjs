#!/usr/bin/env node
// Traduz o DESIGN.md em verificacoes automaticas. Sem isto, "nao use gradiente"
// e so uma sugestao no prompt; com isto, e uma condicao de aceite que o modelo
// local precisa satisfazer sozinho.

import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const CSS = process.argv[2] || resolve(ROOT, 'src/styles.css');

const css = readFileSync(CSS, 'utf8');
const linhas = css.split(/\r?\n/);
const erros = [];

const erro = (i, msg) => erros.push(`styles.css:${i + 1}  ${msg}`);

// Extrair valores de tokens para contraste
const tokens = {
  escuro: { base: null, ink: null }, // carvao e acrilico
  claro: { base: null, ink: null }   // papel
};

const regexTokenBase = /--base\s*:\s*(#[0-9a-f]{6}|rgba?\([^)]+\))/i;
const regexTokenInk = /--ink\s*:\s*(#[0-9a-f]{6}|rgba?\([^)]+\))/i;

for (const linha of linhas) {
  const l = linha.trim();

  // Escuro (acrilico + carvao)
  if (/\[data-theme='(acrilico|carvao)'\]|:root,/.test(l)) {
    for (let i = linhas.indexOf(linha); i < linhas.length; i++) {
      const current = linhas[i].trim();
      if (current.includes('--base') && !current.startsWith('/*')) {
        const match = current.match(regexTokenBase);
        if (match && !tokens.escuro.base) tokens.escuro.base = match[1];
      }
      if (current.includes('--ink:') && !current.startsWith('/*')) {
        const match = current.match(regexTokenInk);
        if (match && !tokens.escuro.ink) tokens.escuro.ink = match[1];
      }
      if (current === '}') break;
    }
  }

  // Claro (papel)
  if (/\[data-theme='papel'\]/.test(l)) {
    for (let i = linhas.indexOf(linha); i < linhas.length; i++) {
      const current = linhas[i].trim();
      if (current.includes('--base') && !current.startsWith('/*')) {
        const match = current.match(regexTokenBase);
        if (match) tokens.claro.base = match[1];
      }
      if (current.includes('--ink:') && !current.startsWith('/*')) {
        const match = current.match(regexTokenInk);
        if (match) tokens.claro.ink = match[1];
      }
      if (current === '}') break;
    }
  }
}

// Funcao para converter hex para sRGB 0-1
const hexToRgb = (hex) => {
  hex = hex.replace('#', '');
  if (hex.length === 6) {
    return {
      r: parseInt(hex.substring(0, 2), 16) / 255,
      g: parseInt(hex.substring(2, 4), 16) / 255,
      b: parseInt(hex.substring(4, 6), 16) / 255
    };
  }
  return null;
};

// Funcao para extrair RGB de rgba()
const rgbaToRgb = (rgba) => {
  const match = rgba.match(/rgba?\(([^)]+)\)/);
  if (!match) return null;
  const parts = match[1].split(',').map(p => p.trim());
  return {
    r: parseInt(parts[0]) / 255,
    g: parseInt(parts[1]) / 255,
    b: parseInt(parts[2]) / 255
  };
};

// Calcula luminancia sRGB (WCAG 2)
const calcularLuminancia = (rgb) => {
  if (!rgb) return null;
  const Rs = rgb.r <= 0.03928 ? rgb.r / 12.92 : Math.pow((rgb.r + 0.055) / 1.055, 2.4);
  const Gs = rgb.g <= 0.03928 ? rgb.g / 12.92 : Math.pow((rgb.g + 0.055) / 1.055, 2.4);
  const Bs = rgb.b <= 0.03928 ? rgb.b / 12.92 : Math.pow((rgb.b + 0.055) / 1.055, 2.4);
  return 0.2126 * Rs + 0.7152 * Gs + 0.0722 * Bs;
};

// Calcula contraste WCAG (L1 + 0.05) / (L2 + 0.05)
const calcularContraste = (cor1, cor2) => {
  let rgb1, rgb2;

  if (cor1.startsWith('#')) rgb1 = hexToRgb(cor1);
  else rgb1 = rgbaToRgb(cor1);

  if (cor2.startsWith('#')) rgb2 = hexToRgb(cor2);
  else rgb2 = rgbaToRgb(cor2);

  if (!rgb1 || !rgb2) return null;

  const l1 = calcularLuminancia(rgb1);
  const l2 = calcularLuminancia(rgb2);

  const lc = Math.max(l1, l2);
  const ld = Math.min(l1, l2);

  return (lc + 0.05) / (ld + 0.05);
};

// Verificar contraste
if (tokens.escuro.base && tokens.escuro.ink) {
  const contrastoEscuro = calcularContraste(tokens.escuro.ink, tokens.escuro.base);
  if (contrastoEscuro !== null && (contrastoEscuro < 7 || contrastoEscuro > 11)) {
    erros.push(`styles.css  contraste do corpo no escuro: ${contrastoEscuro.toFixed(1)}:1 (esperado 7:1 a 11:1)`);
  }
}

if (tokens.claro.base && tokens.claro.ink) {
  const contrastoClaro = calcularContraste(tokens.claro.ink, tokens.claro.base);
  if (contrastoClaro !== null && (contrastoClaro < 10 || contrastoClaro > 16)) {
    erros.push(`styles.css  contraste do corpo no claro: ${contrastoClaro.toFixed(1)}:1 (esperado 10:1 a 16:1)`);
  }
}

// Constantes de validacao
const ESCALA_FONTES = new Set([11, 12, 13, 15, 17, 21, 28]);
const PROPS_TRANSICAO_OK = new Set(['color', 'background-color', 'border-color', 'opacity', 'box-shadow', 'transform', 'none', 'all']);
const DURACAO_MAX = 250; // ms

// Verificar cada linha
linhas.forEach((linha, i) => {
  const l = linha.trim();

  // Ignorar comentarios
  if (l.startsWith('/*') || l.startsWith('*') || !l) return;

  const baixa = l.toLowerCase();
  const ehToken = l.startsWith('--');

  // Regra 1: gradiente proibido
  if (baixa.includes('gradient(')) {
    erro(i, 'gradiente proibido pelo DESIGN.md');
  }

  // Regra 2: blur/glassmorphism proibido
  if (baixa.includes('backdrop-filter') || /filter\s*:\s*blur/.test(baixa)) {
    erro(i, 'blur/glassmorphism proibido');
  }

  // Regra 3: box-shadow deve ser var(--sombra) ou none
  if (/box-shadow\s*:/.test(baixa)) {
    if (!/box-shadow\s*:\s*(?:var\(--sombra\)|none)/.test(baixa)) {
      erro(i, 'sombra so em sobreposi, e sempre var(--sombra)');
    }
  }

  // Regra 4: border-radius maximo 6px
  if (/border-radius/.test(baixa)) {
    if (/border-radius\s*:\s*(50%|999)/.test(baixa)) {
      erro(i, 'raio maximo e 6px');
    }
    // Verificar cada valor de border-radius (pode ser lista)
    const raioMatch = baixa.match(/border-radius\s*:\s*([^;]+)/);
    if (raioMatch) {
      const valores = raioMatch[1].split(/\s+/).filter(v => v && v !== ';');
      for (const val of valores) {
        if (val.includes('px')) {
          const num = parseInt(val);
          if (num > 6) {
            erro(i, 'raio maximo e 6px');
            break;
          }
        }
      }
    }
  }

  // Regra 5: font-size na escala
  if (/font-size\s*:/.test(baixa)) {
    const tamanho = baixa.match(/font-size\s*:\s*(\d+)px/);
    if (tamanho) {
      const num = Number(tamanho[1]);
      if (!ESCALA_FONTES.has(num)) {
        erro(i, `font-size ${num}px fora da escala 11/12/13/15/17/21/28`);
      }
    }
  }

  // Regra 6: fonte Inter proibida
  if (/\binter\b/.test(baixa) && baixa.includes('font')) {
    erro(i, 'fonte Inter proibida');
  }

  // Regra 7: cor literal fora de token
  if (!ehToken) {
    // Procurar literais de cor fora de tokens
    if (/#[0-9a-f]{3,8}\b/i.test(baixa)) {
      // Encontrou hex
      const cores = baixa.match(/#[0-9a-f]{3,8}\b/gi);
      for (const cor of cores) {
        erro(i, `cor literal fora dos tokens: use var(--...)`);
        break; // Apenas um erro por linha
      }
    } else if (/rgba?\(|hsla?\(/.test(baixa)) {
      // Encontrou rgb/rgba/hsl/hsla
      erro(i, `cor literal fora dos tokens: use var(--...)`);
    }
  }

  // Regra 8: transition - propriedades e duracao
  if (/transition\s*:/.test(baixa)) {
    const transMatch = baixa.match(/transition\s*:\s*([^;]+)/);
    if (transMatch) {
      const partes = transMatch[1].split(',');
      for (const parte of partes) {
        const p = parte.trim();
        // Extrair propriedade (primeira palavra)
        const propMatch = p.match(/^([a-z-]+)/);
        if (propMatch) {
          const prop = propMatch[1];
          if (!PROPS_TRANSICAO_OK.has(prop)) {
            erro(i, `transicao de "${prop}" proibida: so color, background-color, border-color, opacity, box-shadow, transform`);
            break;
          }
        }

        // Verificar duracao
        const durMatch = p.match(/(\d+)ms/);
        if (durMatch) {
          const dur = Number(durMatch[1]);
          if (dur > DURACAO_MAX) {
            erro(i, `duracao da transicao ${dur}ms acima do maximo 250ms`);
            break;
          }
        } else if (/var\(--(?:rapido|entrada)\)/.test(p)) {
          // var(--rapido) = 150ms, var(--entrada) = 250ms, ambos OK
        }
      }
    }
  }

  // Regra 8b: animation - propriedades e duracao
  if (/animation\s*:/.test(baixa)) {
    const animMatch = baixa.match(/animation\s*:\s*([^;]+)/);
    if (animMatch) {
      const valor = animMatch[1];
      // Verificar duracao
      const durMatch = valor.match(/(\d+)ms/);
      if (durMatch) {
        const dur = Number(durMatch[1]);
        if (dur > DURACAO_MAX) {
          erro(i, `duracao da animacao ${dur}ms acima do maximo 250ms`);
        }
      } else if (/var\(--(?:rapido|entrada)\)/.test(valor)) {
        // var(--rapido) ou var(--entrada) OK
      }
    }
  }

  // Regra 9: transform - so translate permitido
  if (/transform\s*:/.test(baixa)) {
    if (/\b(scale|rotate|skew)/i.test(baixa)) {
      erro(i, 'so translate e permitido em transform');
    }
  }
});

if (erros.length > 0) {
  console.error(`DESIGN.md violado (${erros.length}):`);
  for (const e of erros.slice(0, 25)) console.error(`  ${e}`);
  process.exit(1);
}

console.log('design ok');
