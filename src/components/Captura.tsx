import { useEffect, useRef, useState } from 'react';
import { abrirDeposito } from '../deposito';
import { carregarAjustes } from '../ajustes';

/**
 * A janelinha que o atalho do sistema abre em qualquer lugar do Windows.
 * Escreve, Ctrl+Enter guarda, Esc desiste. Nada mais cabe aqui: o valor desta
 * tela é não ter nada para decidir.
 */
export default function Captura() {
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  const deposito = useRef(abrirDeposito()).current;

  useEffect(() => {
    const { tema, corpo } = carregarAjustes();
    document.documentElement.dataset.theme = tema;
    // só dentro do Electron o fundo pode ser transparente: fora dele não há
    // acrílico atrás da janela e o texto ficaria sobre o branco do navegador
    if (navigator.userAgent.includes('Electron')) {
      document.documentElement.dataset.native = 'true';
    }
    document.documentElement.style.setProperty('--corpo', `${corpo}px`);
    areaRef.current?.focus();
  }, []);

  async function guardar() {
    const conteudo = texto.trim();
    if (!conteudo) {
      window.ardosia?.fecharCaptura(false);
      return;
    }
    try {
      const nota = deposito.criar('markdown');
      await deposito.salvar({ ...nota, blocos: [{ ...nota.blocos[0], texto: conteudo }] });
      setTexto('');
      setErro(false);
      await window.ardosia?.fecharCaptura(true);
    } catch (err) {
      console.error('Não foi possível guardar a captura:', err);
      setErro(true);
    }
  }

  function aoTeclar(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Escape') {
      setTexto('');
      window.ardosia?.fecharCaptura(false);
    }
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void guardar();
    }
  }

  return (
    <div className="captura">
      <textarea
        className="captura__texto"
        ref={areaRef}
        value={texto}
        placeholder="Escreva e esqueça"
        spellCheck={false}
        onChange={(event) => setTexto(event.target.value)}
        onKeyDown={aoTeclar}
      />
      <footer className="captura__rodape">
        <span>Ctrl + Enter guarda · Esc desiste</span>
        {erro && <span className="editor__estado--erro">Não foi possível guardar</span>}
      </footer>
    </div>
  );
}
