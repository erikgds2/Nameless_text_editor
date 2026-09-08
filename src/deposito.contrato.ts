/**
 * O que TODO depósito de notas precisa fazer, seja ele a pasta do aplicativo, a
 * mesma pasta vista pelo navegador, ou o localStorage.
 *
 * Esta bateria roda igual contra as três implementações. Se uma divergir, o
 * teste acusa — e é exatamente a divergência entre elas que faria alguém perder
 * nota ao trocar de ambiente.
 *
 * Só entra aqui o que é comum às três. Onde elas legitimamente diferem (o
 * localStorage não batiza arquivo pelo título, porque não há arquivo), o teste
 * mora no arquivo da implementação.
 */
import { describe, expect, it } from 'vitest';
import type { Deposito } from './deposito';
import { textoDaNota, type Note } from './notes';
import { criarBloco } from './canvas';

type Fabrica = () => Deposito | Promise<Deposito>;

export function contratoDeDeposito(nome: string, fabricar: Fabrica): void {
  const abrir = async () => await fabricar();

  /** Uma nota do depósito, já com texto — sem passar por interface nenhuma. */
  async function comTexto(deposito: Deposito, texto: string, extras: Partial<Note> = {}) {
    const nota = deposito.criar('markdown');
    return await deposito.salvar({
      ...nota,
      blocos: [{ ...nota.blocos[0], texto }],
      ...extras,
    });
  }

  describe(`contrato de depósito — ${nome}`, () => {
    it('começa vazio', async () => {
      expect(await (await abrir()).listar()).toEqual([]);
    });

    it('a nota nova nasce com um bloco para escrever e o tipo pedido', async () => {
      const deposito = await abrir();
      const nota = deposito.criar('texto');
      expect(nota.blocos).toHaveLength(1);
      expect(nota.blocos[0].texto).toBe('');
      expect(nota.tipo).toBe('texto');
    });

    it('o que foi salvo volta na listagem', async () => {
      const deposito = await abrir();
      await comTexto(deposito, 'Imperativo categórico');
      const [lida] = await deposito.listar();
      expect(textoDaNota(lida.blocos)).toBe('Imperativo categórico');
    });

    it('salvar a mesma nota duas vezes não cria duas', async () => {
      const deposito = await abrir();
      const primeira = await comTexto(deposito, 'Kant');
      await deposito.salvar({
        ...primeira,
        blocos: [{ ...primeira.blocos[0], texto: 'Kant revisado' }],
      });

      const todas = await deposito.listar();
      expect(todas).toHaveLength(1);
      expect(textoDaNota(todas[0].blocos)).toBe('Kant revisado');
    });

    it('duas notas diferentes convivem', async () => {
      const deposito = await abrir();
      await comTexto(deposito, 'Kant');
      await comTexto(deposito, 'Hume');
      expect(await deposito.listar()).toHaveLength(2);
    });

    it('o id devolvido por salvar é o id que a listagem traz', async () => {
      const deposito = await abrir();
      const salva = await comTexto(deposito, 'Revisão de Cálculo');
      const [lida] = await deposito.listar();
      expect(lida.id).toBe(salva.id);
    });

    it('apagar tira a nota, e apagar o que não existe não quebra', async () => {
      const deposito = await abrir();
      const salva = await comTexto(deposito, 'some daqui');
      await deposito.apagar(salva.id);
      expect(await deposito.listar()).toEqual([]);
      await expect(deposito.apagar('nunca-existiu')).resolves.not.toThrow();
    });

    it('o texto atravessa inteiro: acento, emoji, quebra de linha e Markdown', async () => {
      const deposito = await abrir();
      const original = '# Ação 🎯\n\nÍmã, **coração** e `código`.\n\n- um\n- dois';
      await comTexto(deposito, original);
      const [lida] = await deposito.listar();
      expect(textoDaNota(lida.blocos)).toBe(original);
    });

    it('a geometria dos blocos sobrevive', async () => {
      const deposito = await abrir();
      const nota = deposito.criar('markdown');
      const salva = await deposito.salvar({
        ...nota,
        blocos: [
          { ...criarBloco(48, 48), largura: 320, altura: 140, texto: 'primeiro' },
          { ...criarBloco(420, 260), largura: 280, altura: 200, texto: 'segundo' },
        ],
      });

      const [lida] = await deposito.listar();
      expect(lida.blocos).toHaveLength(2);
      expect(lida.blocos.map(({ id, ...resto }) => resto)).toEqual(
        salva.blocos.map(({ id, ...resto }) => resto),
      );
    });

    it('o tipo do documento sobrevive', async () => {
      const deposito = await abrir();
      const nota = deposito.criar('texto');
      await deposito.salvar({ ...nota, blocos: [{ ...nota.blocos[0], texto: 'texto puro' }] });
      const [lida] = await deposito.listar();
      expect(lida.tipo).toBe('texto');
    });

    it('nota fixada volta fixada, e na mesma posição', async () => {
      const deposito = await abrir();
      await comTexto(deposito, 'Segunda fixada', { pinned: true, ordem: 1 });
      await comTexto(deposito, 'Primeira fixada', { pinned: true, ordem: 0 });

      const lidas = await deposito.listar();
      const porOrdem = [...lidas].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
      expect(porOrdem.every((nota) => nota.pinned)).toBe(true);
      expect(porOrdem.map((nota) => textoDaNota(nota.blocos))).toEqual([
        'Primeira fixada',
        'Segunda fixada',
      ]);
    });

    it('a data de edição sobrevive', async () => {
      const deposito = await abrir();
      const quando = Date.UTC(2026, 8, 7, 22, 40);
      await comTexto(deposito, 'Datada', { updatedAt: quando });
      const [lida] = await deposito.listar();
      expect(lida.updatedAt).toBe(quando);
    });

    it('uma nota sem texto nenhum continua sendo uma nota', async () => {
      const deposito = await abrir();
      const nota = deposito.criar('markdown');
      await deposito.salvar(nota);
      const [lida] = await deposito.listar();
      expect(lida.blocos).toHaveLength(1);
      expect(textoDaNota(lida.blocos)).toBe('');
    });
  });
}
