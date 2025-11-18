# 📊 VLR.gg Picks/Bans Scraper

<div align="center">

![Version](https://img.shields.io/badge/version-1.0-ff4655)
![License](https://img.shields.io/badge/license-MIT-blue)
![Tampermonkey](https://img.shields.io/badge/tampermonkey-required-green)

Um userscript poderoso para extrair dados de picks e bans de mapas do **VLR.gg** (Valorant esports).

[Instalação](#-instalação) • [Como Usar](#-como-usar) • [Features](#-features) • [Exemplo](#-exemplo-de-saída-json)

</div>

---

## 🎯 Sobre

O **VLR Picks/Bans Scraper** é um userscript desenvolvido em JavaScript puro que automatiza a coleta e análise de dados de picks e bans de mapas de times de Valorant a partir do site [VLR.gg](https://www.vlr.gg).

Ideal para analistas, coaches e entusiastas que desejam estudar padrões estratégicos de times profissionais.

## ✨ Features

- 🔍 **Extração automática** de picks/bans de múltiplas partidas
- 📄 **Suporte a paginação** - coleta dados de todas as páginas disponíveis
- 🎯 **Filtros avançados**:
  - Por time específico
  - Por evento/torneio
  - Por período de datas
  - Limite customizável de partidas
- 📊 **Estatísticas agregadas**:
  - Total de picks e bans por time
  - Composição detalhada por mapa
  - Histórico completo de ações
- 🎨 **Interface moderna e draggable**
- 💾 **Exportação em JSON** para análises externas
- ⚡ **Performance otimizada** com delays entre requisições

## 🚀 Instalação

### Pré-requisitos

- Navegador: Chrome, Firefox, Edge, Opera ou Safari
- Extensão: [Tampermonkey](https://www.tampermonkey.net/) ou [Violentmonkey](https://violentmonkey.github.io/)

### Passos

1. **Instale o Tampermonkey** no seu navegador:

   - [Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojewgfgphdmcecefb)
   - [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
   - [Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)

2. **Instale o script**:

   - Clique em [**vlr-map-scrapper.user.js**](vlr-map-scrapper/vlr-map-scrapper.user.js)
   - Ou copie o código e crie um novo script no Tampermonkey

3. **Acesse o VLR.gg** - o ícone flutuante aparecerá automaticamente! 📊

## 📖 Como Usar

### 1. Abra a Interface

Acesse qualquer página do [VLR.gg](https://www.vlr.gg) e clique no ícone flutuante vermelho no canto inferior direito.

### 2. Configure os Filtros

```
URL do Time*:        https://www.vlr.gg/team/8050/mibr-gc
URL do Evento:       https://www.vlr.gg/event/2617/game-changers... (opcional)
Data De:             2024-01-01 (opcional)
Data Até:            2024-12-31 (opcional)
Limite de matches:   200
```

### 3. Execute o Scraping

Clique em **🚀 Iniciar Scraping** e aguarde a coleta dos dados.

### 4. Visualize os Resultados

O script exibirá:

- ✅ Número de séries válidas
- 📊 Resumo: Total de picks, bans e séries
- 🗺️ Tabela detalhada por mapa

### 5. Exporte os Dados

Clique em **💾 Exportar JSON** para salvar os dados completos.

## 📊 Exemplo de Saída (JSON)

```json
{
  "teamName": "MIBR GC",
  "teamStats": {
    "pick": 45,
    "ban": 38,
    "matches": 15
  },
  "aggregatedByMap": {
    "Ascent": { "pick": 8, "ban": 5 },
    "Haven": { "pick": 7, "ban": 6 },
    "Bind": { "pick": 6, "ban": 8 }
  },
  "detailed": [
    {
      "url": "https://www.vlr.gg/123456/...",
      "date": "2024-06-15T00:00:00.000Z",
      "event": "Game Changers Championship",
      "picks": 3,
      "bans": 2,
      "actions": [
        { "team": "MIBR GC", "action": "ban", "map": "Bind" },
        { "team": "MIBR GC", "action": "pick", "map": "Ascent" }
      ]
    }
  ]
}
```

## 🎨 Interface

- **Ícone Flutuante**: Acesso rápido sempre visível
- **Modal Draggable**: Mova a janela para qualquer posição
- **Design Moderno**: Tema dark com gradientes e animações
- **Responsivo**: Adapta-se ao tamanho da tela

## 🛠️ Tecnologias

- **JavaScript (ES6+)** - Vanilla JS puro
- **DOM API** - Manipulação e parsing de HTML
- **Fetch API** - Requisições assíncronas
- **CSS-in-JS** - Estilização inline otimizada

## 📝 Notas Técnicas

### Como Funciona

1. **Extração do Time**: Identifica o nome oficial do time na página
2. **Coleta de Matches**: Navega pela aba "Matches" com suporte a paginação
3. **Filtragem**: Aplica filtros de data e evento
4. **Parsing**: Extrai strings de pick/ban de cada partida
5. **Agregação**: Compila estatísticas por mapa e ação
6. **Apresentação**: Exibe resultados na UI customizada

### Rate Limiting

- Delay de **400ms** entre requisições de match
- Delay de **500ms** entre páginas de paginação
- Previne bloqueios e garante estabilidade

## ⚠️ Limitações

- Depende da estrutura HTML do VLR.gg (pode quebrar se o site mudar)
- Requer conexão estável para múltiplas requisições
- Funciona apenas com times que têm histórico público no VLR.gg

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se livre para:

1. 🍴 Fork o projeto
2. 🌿 Crie uma branch (`git checkout -b feature/nova-feature`)
3. 💾 Commit suas mudanças (`git commit -m 'Adiciona nova feature'`)
4. 📤 Push para a branch (`git push origin feature/nova-feature`)
5. 🔃 Abra um Pull Request

## 📜 Licença

Este projeto está sob a licença **MIT**. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 👤 Autor

**dollyzn**

---

<div align="center">

Feito com ❤️ para a comunidade de Valorant esports

⭐ Se este projeto foi útil, considere dar uma estrela!

</div>
