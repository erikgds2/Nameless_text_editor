# Gera o icone do app a partir dos tokens do DESIGN.md.
# O desenho conta o que o app faz: dois blocos de escrita soltos sobre a ardosia,
# em vez de um texto corrido. Nada de gradiente, nada de canto arredondado.
#
#   python build/gerar-icone.py

from PIL import Image, ImageDraw
from pathlib import Path

TINTA = (26, 23, 20, 255)      # --ink   #1A1714
OCRE = (164, 85, 26, 255)      # --accent #A4551A
PAPEL = (247, 244, 237, 255)   # --paper  #F7F4ED
REGUA = (221, 214, 199, 255)   # --rule   #DDD6C7

TAMANHOS = [16, 24, 32, 48, 64, 128, 256]


def desenhar(lado: int) -> Image.Image:
    # desenha grande e reduz: bordas finas sobrevivem melhor assim
    escala = 8
    px = lado * escala
    img = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    u = px / 32.0  # unidade de grade

    # a ardosia: superficie escura ocupando quase todo o quadro
    d.rectangle([u * 2, u * 2, u * 30, u * 30], fill=TINTA)

    # moldura ocre — a identidade da marca
    espessura = max(1, int(u * 1.5))
    d.rectangle([u * 2, u * 2, u * 30, u * 30], outline=OCRE, width=espessura)

    # bloco de escrita 1: tres linhas no alto, a esquerda
    linha = max(1, int(u * 1.4))
    for i, largura in enumerate((12, 12, 8)):
        y = u * (7 + i * 4)
        d.line([(u * 6, y), (u * (6 + largura), y)], fill=PAPEL, width=linha)

    # bloco de escrita 2: deslocado, mostrando que os blocos sao livres
    for i, largura in enumerate((7, 5)):
        y = u * (20 + i * 4)
        d.line([(u * 16, y), (u * (16 + largura), y)], fill=REGUA, width=linha)

    return img.resize((lado, lado), Image.LANCZOS)


def main() -> None:
    destino = Path(__file__).parent
    imagens = [desenhar(lado) for lado in TAMANHOS]

    imagens[-1].save(destino / "icone.png")
    imagens[-1].save(
        destino / "icone.ico",
        format="ICO",
        sizes=[(lado, lado) for lado in TAMANHOS],
    )
    print(f"gerados: {destino / 'icone.ico'} e icone.png ({', '.join(map(str, TAMANHOS))})")


if __name__ == "__main__":
    main()
