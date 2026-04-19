O Conceito de Marca
O logotipo central é um monograma que funciona tanto como ícone do app quanto elemento gráfico do logo completo. Ele utiliza a forma de um "S" estilizado para desenhar o encosto e o assento de um sofá modular moderno. A curvatura do "S" evoca conforto e fluidez (o processo de compra/venda), enquanto as linhas limpas garantem clareza e profissionalismo.

A tipografia escolhida é uma sans-serif geométrica moderna (similar à Inter ou Manrope), equilibrando a solidez e a legibilidade para um público B2B (lojistas).

Visualização dos Assets
Aqui estão os mocks de como os assets foram gerados e como eles aparecem em diferentes contextos de uso.

Entregáveis e Especificações Técnicas
Os seguintes assets foram gerados e organizados de acordo com os requisitos. Todos os SVGs possuem paths limpos e as imagens PNG utilizam o perfil sRGB padrão.

1. Arquivos para /public (Favicon e PWA)
Estes arquivos estão otimizados para alto contraste e legibilidade em tamanhos mínimos.

favicon.svg

Tipo: Vetorial (SVG)

Formato: Quadrado com cantos levemente arredondados (para consistência visual, integrado ao path).

ViewBox: Otimizado para 32×32 ou 48×48.

Conteúdo: Apenas o monograma "S-sofa" em Laranja Queimado (#ea580c) sobre fundo Off-White ou transparente (dependendo do modo do navegador; o asset gerado prioriza o contraste).

pwa-192x192.png

Tipo: Raster (PNG), sRGB.

Dimensão: Exatamente 192×192 px.

Conteúdo: O monograma "S-sofa" Laranja Queimado centralizado em um quadrado de fundo sólido Ardósia Escura (#0f172a). Sem transparência.

Maskable: O elemento principal está contido na zona segura central de ~80%, garantindo que o Android possa recortar o ícone em círculo ou quadrado sem cortar o logo.

pwa-512x512.png

Tipo: Raster (PNG), sRGB.

Dimensão: Exatamente 512×512 px.

Conteúdo: Mesma composição do arquivo de 192px (monograma laranja sobre fundo ardósia sólido), com maior definição.

2. Logotipos para Uso Geral (Lojas, PDFs, Marketing)
Estes arquivos possuem fundo transparente e alta resolução/escalabilidade.

logo-sofashop-full.svg

Tipo: Vetorial (SVG), paths limpos (texto convertido em curvas para garantir fidelidade).

Formato: Horizontal.

Conteúdo: [Ícone Monograma Laranja] + [Texto "SofáShop" em Ardósia (#1e293b)]. A palavra "Sofá" tem um peso ligeiramente maior que "Shop" para hierarquia.

Uso: Cabeçalho de PDFs, e-mails comerciais, topo da plataforma administrativa.

logo-sofashop-icon.svg

Tipo: Vetorial (SVG), paths limpos.

Formato: Quadrado.

Conteúdo: Apenas o monograma "S-sofa" Laranja Queimado (#ea580c) com fundo transparente.

Uso: Espaços quadrados, avatares de redes sociais da plataforma, marcas d'água.

Paleta de Cores Utilizada
Para referência no desenvolvimento do front-end e personalização:

Laranja Queimado (Accent): #ea580c

Ardósia Escura (Fundo PWA/Texto Principal): #0f172a

Ardósia Média (Texto Secundário no Logo): #1e293b

Off-White (Contraste opcional): #f8fafc (Usado sutilmente no mockup do favicon).
