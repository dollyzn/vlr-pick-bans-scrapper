// ==UserScript==
// @name         VLR.gg Map Picks/Bans Scraper
// @namespace    https://github.com/dollyzn/vlr-pick-bans-scrapper
// @version      1.0
// @updateURL    https://github.com/dollyzn/vlr-pick-bans-scrapper/raw/main/vlr-map-scrapper/vlr-map-scrapper.user.js
// @downloadURL  https://github.com/dollyzn/vlr-pick-bans-scrapper/raw/main/vlr-map-scrapper/vlr-map-scrapper.user.js
// @description  Scrape picks/bans de mapas do vlr.gg - versão final com paginação e UI draggable
// @author       dollyzn
// @match        https://www.vlr.gg/*
// @grant        none
// ==/UserScript==

(async function () {
  "use strict";

  // --- Utility functions ---
  function absoluteUrl(href) {
    if (!href) return null;
    if (href.startsWith("http")) return href;
    return new URL(href, "https://www.vlr.gg").toString();
  }

  function parseDateFromText(text) {
    const match = text.match(/(\d{4})\/(\d{2})\/(\d{2})/);
    if (match) {
      return new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
    }
    const d = new Date(text);
    if (!isNaN(d)) return d;
    return null;
  }

  async function fetchDoc(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch ${url} falhou: ${res.status}`);
    const html = await res.text();
    const parser = new DOMParser();
    return parser.parseFromString(html, "text/html");
  }

  function normalizeTeamName(name) {
    if (!name) return "";
    return name
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/\./g, "")
      .replace(/-/g, "");
  }

  function teamMatches(teamName, filterName) {
    const teamNorm = normalizeTeamName(teamName);
    const filterNorm = normalizeTeamName(filterName);
    return (
      teamNorm === filterNorm ||
      teamNorm.includes(filterNorm) ||
      filterNorm.includes(teamNorm)
    );
  }

  function extractEventPath(url) {
    if (!url) return null;
    try {
      const urlObj = new URL(url, "https://www.vlr.gg");
      return urlObj.pathname;
    } catch {
      if (url.startsWith("/event/")) return url;
      return null;
    }
  }

  function extractTeamNameFromPage(doc) {
    const headerNameDiv = doc.querySelector(".team-header-name");

    if (headerNameDiv) {
      const tagH2 = headerNameDiv.querySelector("h2.team-header-tag");
      if (tagH2) {
        const name = tagH2.textContent.trim();
        console.log(`   ✓ Nome extraído de h2.team-header-tag: "${name}"`);
        return name;
      }

      const titleH1 = headerNameDiv.querySelector("h1.wf-title");
      if (titleH1) {
        let text = "";
        for (const node of titleH1.childNodes) {
          if (node.nodeType === Node.TEXT_NODE) {
            text += node.textContent;
          } else if (
            node.tagName === "SPAN" &&
            !node.classList.contains("tag")
          ) {
            text += node.textContent;
          }
        }
        const name = text.trim();
        console.log(`   ✓ Nome extraído de h1.wf-title: "${name}"`);
        return name;
      }
    }

    const titleEl = doc.querySelector("h1.wf-title");
    if (titleEl) {
      let text = "";
      for (const node of titleEl.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          text += node.textContent;
        } else if (node.tagName === "SPAN" && !node.classList.contains("tag")) {
          text += node.textContent;
        }
      }
      const name = text.trim();
      console.log(`   ✓ Nome extraído (fallback) de h1.wf-title: "${name}"`);
      return name;
    }

    return null;
  }

  // NOVA: Detectar total de páginas de paginação
  function getMaxPage(doc) {
    const pageLinks = doc.querySelectorAll(
      ".action-container-pages a.btn.mod-page, .action-container-pages span.btn.mod-page"
    );
    let maxPage = 1;

    for (const link of pageLinks) {
      const text = link.textContent.trim();
      const pageNum = parseInt(text);
      if (!isNaN(pageNum) && pageNum > maxPage) {
        maxPage = pageNum;
      }
    }

    return maxPage;
  }

  // NOVA: Buscar matches de todas as páginas
  async function fetchAllMatchesPages(baseUrl, maxMatches) {
    const allMatches = [];

    // Primeira página
    console.log("📄 Buscando página 1...");
    const firstPageDoc = await fetchDoc(baseUrl);
    const firstPageMatches = extractMatchesFromContainer(firstPageDoc);
    allMatches.push(...firstPageMatches);

    // Detectar total de páginas
    const totalPages = getMaxPage(firstPageDoc);
    console.log(`📚 Total de páginas detectadas: ${totalPages}\n`);

    if (totalPages > 1) {
      // Buscar páginas restantes
      for (let page = 2; page <= totalPages; page++) {
        if (allMatches.length >= maxMatches) {
          console.log(
            `✋ Limite de ${maxMatches} matches atingido, parando paginação\n`
          );
          break;
        }

        const pageUrl = `${baseUrl}&page=${page}`;
        console.log(`📄 Buscando página ${page}...`);

        try {
          const pageDoc = await fetchDoc(pageUrl);
          const pageMatches = extractMatchesFromContainer(pageDoc);
          allMatches.push(...pageMatches);
          console.log(`   ✓ ${pageMatches.length} matches encontrados\n`);

          // Delay entre páginas
          await new Promise((res) => setTimeout(res, 500));
        } catch (err) {
          console.warn(`   ⚠️ Erro ao buscar página ${page}: ${err.message}\n`);
        }
      }
    }

    return allMatches;
  }

  async function navigateToMatchesTab(teamUrl) {
    const match = teamUrl.match(/\/team\/(\d+)/);
    if (!match) throw new Error("URL do time inválida");

    const teamId = match[1];
    const teamSlug = teamUrl.split("/").pop();

    return `https://www.vlr.gg/team/matches/${teamId}/${teamSlug}?group=completed`;
  }

  function extractMatchesFromContainer(doc) {
    const matches = [];
    const matchCards = doc.querySelectorAll(".wf-card.fc-flex.m-item");

    for (const card of matchCards) {
      const linkEl =
        card.tagName === "A" ? card : card.querySelector("a[href]");

      if (!linkEl) continue;

      const href = linkEl.getAttribute("href");
      if (!href || !href.match(/^\/\d+\//)) continue;

      const matchUrl = absoluteUrl(href);

      let matchDate = null;
      const dateEl = card.querySelector(".m-item-date");
      if (dateEl) {
        const dateText = dateEl.textContent.trim();
        matchDate = parseDateFromText(dateText);
      }

      matches.push({
        url: matchUrl,
        date: matchDate,
      });
    }

    return matches;
  }

  function checkEventFilter(doc, eventFilterPath) {
    if (!eventFilterPath) return true;

    const eventLinkEl = doc.querySelector(
      'a.match-header-event[href^="/event"]'
    );

    if (!eventLinkEl) {
      console.log("   ⚠️  Link de evento não encontrado na página");
      return false;
    }

    const eventHref = eventLinkEl.getAttribute("href");

    console.log(`   🏆 Evento do match: "${eventHref}"`);
    console.log(`   🎯 Filtro: "${eventFilterPath}"`);

    const normalize = (path) => path.replace(/\/$/, "").toLowerCase();

    const matchEventPath = normalize(eventHref);
    const filterPath = normalize(eventFilterPath);

    const matches =
      matchEventPath.startsWith(filterPath) ||
      filterPath.startsWith(matchEventPath);

    console.log(`   ${matches ? "✅" : "❌"} Match de evento`);

    return matches;
  }

  function extractPicksBansFromMatchPage(doc, filterTeamName) {
    let pickBanString = "";
    const paragraphs = Array.from(
      doc.querySelectorAll(
        "p, div.match-header-note, div.match-header-vs-note, .match-header-vs-note"
      )
    );

    for (const p of paragraphs) {
      const text = p.textContent || "";
      if (text.includes("ban") && text.includes("pick")) {
        pickBanString = text.trim();
        break;
      }
    }

    if (!pickBanString) {
      const allText = doc.body.textContent;
      const lines = allText.split("\n");
      for (const line of lines) {
        if (
          line.includes("pick") &&
          line.includes("ban") &&
          line.includes(";")
        ) {
          pickBanString = line.trim();
          break;
        }
      }
    }

    if (!pickBanString) return null;

    console.log(`   📝 Pick/ban string encontrada`);

    const actions = [];
    const parts = pickBanString.split(/[;,]/).map((s) => s.trim());

    for (const part of parts) {
      const lower = part.toLowerCase();
      let action = null;
      if (lower.includes(" ban ")) action = "ban";
      else if (lower.includes(" pick ")) action = "pick";

      if (!action) continue;

      const regex = /(.*?)\s+(ban|pick)\s+(.*)/i;
      const match = part.match(regex);
      if (match) {
        let team = match[1].trim();
        let map = match[3].trim();

        team = team.replace(/\./g, " ").replace(/\s+/g, " ");
        map = map.charAt(0).toUpperCase() + map.slice(1).toLowerCase();

        if (teamMatches(team, filterTeamName)) {
          actions.push({ team, action, map });
          console.log(`      ✓ ${action}: ${map}`);
        }
      }
    }

    return actions;
  }

  function extractEventName(doc) {
    const eventEl = doc.querySelector(
      ".match-header-event-series, .match-header-event .text-of"
    );
    return eventEl ? eventEl.textContent.trim() : "N/A";
  }

  // --- Main orchestration ---
  async function analyzeMatches(options = {}) {
    const {
      teamUrl,
      eventFilterUrl,
      fromDate,
      toDate,
      maxMatches = 100,
    } = options;

    if (!teamUrl) {
      throw new Error("❌ URL do time é obrigatória!");
    }

    console.log("\n🚀 Iniciando scraping...\n");

    const eventFilterPath = eventFilterUrl
      ? extractEventPath(eventFilterUrl)
      : null;
    if (eventFilterPath) {
      console.log(`🎯 Filtro de evento ativo: "${eventFilterPath}"\n`);
    }

    // 1. Buscar página do time
    console.log("📥 Acessando página do time:", teamUrl);
    const teamDoc = await fetchDoc(teamUrl);

    // 2. Extrair nome do time
    const teamName = extractTeamNameFromPage(teamDoc);
    if (!teamName) {
      throw new Error("❌ Não foi possível extrair o nome do time");
    }
    console.log(`✅ Time identificado: "${teamName}"\n`);

    // 3. Navegar para aba Matches
    const matchesUrl = await navigateToMatchesTab(teamUrl);

    // 4. NOVA: Extrair matches de TODAS as páginas
    const matchList = await fetchAllMatchesPages(matchesUrl, maxMatches);

    if (matchList.length === 0) {
      throw new Error("❌ Nenhum match encontrado");
    }

    console.log(`📋 Total de matches coletados: ${matchList.length}\n`);

    // 5. Filtrar por data
    let filteredByDate = matchList;
    if (fromDate || toDate) {
      filteredByDate = matchList.filter((m) => {
        if (!m.date) return true;
        if (fromDate && m.date < fromDate) return false;
        if (toDate && m.date > toDate) return false;
        return true;
      });

      const removed = matchList.length - filteredByDate.length;
      if (removed > 0) {
        console.log(`🗓️  Filtro de data removeu ${removed} matches`);
        console.log(
          `   De: ${
            fromDate ? fromDate.toISOString().split("T")[0] : "qualquer"
          }`
        );
        console.log(
          `   Até: ${
            toDate ? toDate.toISOString().split("T")[0] : "qualquer"
          }\n`
        );
      }
    }

    const toProcess = filteredByDate.slice(0, maxMatches);
    console.log(
      `📊 Processando ${toProcess.length} matches (limite: ${maxMatches})\n`
    );

    // 6. Processar cada match
    const teamStats = { pick: 0, ban: 0, matches: 0 };
    const aggregatedByMap = {};
    const detailed = [];
    let filteredOut = { event: 0, noData: 0 };

    for (let i = 0; i < toProcess.length; i++) {
      const matchInfo = toProcess[i];
      const url = matchInfo.url;

      try {
        console.log(`📄 [${i + 1}/${toProcess.length}] ${url}`);
        if (matchInfo.date) {
          console.log(
            `   📅 Data: ${matchInfo.date.toISOString().split("T")[0]}`
          );
        }

        const matchDoc = await fetchDoc(url);

        if (eventFilterPath) {
          if (!checkEventFilter(matchDoc, eventFilterPath)) {
            console.log(`   ⏭️  Filtrado: evento diferente\n`);
            filteredOut.event++;
            continue;
          }
        }

        const actions = extractPicksBansFromMatchPage(matchDoc, teamName);

        if (!actions || actions.length === 0) {
          console.log(`   ⚠️  Sem dados de pick/ban\n`);
          filteredOut.noData++;
          continue;
        }

        console.log(`   ✅ ${actions.length} ações válidas\n`);

        let picks = 0,
          bans = 0;
        for (const action of actions) {
          teamStats[action.action]++;

          const map = action.map;
          if (!aggregatedByMap[map]) aggregatedByMap[map] = { pick: 0, ban: 0 };
          aggregatedByMap[map][action.action]++;

          if (action.action === "pick") picks++;
          else bans++;
        }

        teamStats.matches++;

        const eventName = extractEventName(matchDoc);

        detailed.push({
          url,
          date: matchInfo.date,
          event: eventName,
          picks,
          bans,
          actions,
        });

        await new Promise((res) => setTimeout(res, 400));
      } catch (err) {
        console.warn(`   ⚠️ Erro: ${err.message}\n`);
      }
    }

    console.log(`\n✅ Processamento concluído:`);
    console.log(`   - Séries válidas: ${teamStats.matches}`);
    console.log(`   - Filtradas por evento: ${filteredOut.event}`);
    console.log(`   - Sem dados: ${filteredOut.noData}\n`);

    return {
      teamName,
      teamStats,
      aggregatedByMap,
      detailed,
      filteredOut,
      filters: {
        team: teamName,
        event: eventFilterPath,
        fromDate,
        toDate,
      },
    };
  }

  // --- UI com drag & drop e ícone flutuante ---
  function createUI() {
    // Ícone flutuante
    const floatingBtn = document.createElement("div");
    floatingBtn.id = "vlr-scraper-btn";
    floatingBtn.innerHTML = "📊";
    floatingBtn.style.cssText = `
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 999998;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, #ff4655 0%, #ff1744 100%);
      color: white;
      font-size: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(255, 70, 85, 0.5);
      transition: all 0.3s ease;
      user-select: none;
    `;

    floatingBtn.onmouseenter = () => {
      floatingBtn.style.transform = "scale(1.1)";
      floatingBtn.style.boxShadow = "0 6px 20px rgba(255, 70, 85, 0.7)";
    };

    floatingBtn.onmouseleave = () => {
      floatingBtn.style.transform = "scale(1)";
      floatingBtn.style.boxShadow = "0 4px 12px rgba(255, 70, 85, 0.5)";
    };

    document.body.appendChild(floatingBtn);

    // Modal principal
    const container = document.createElement("div");
    container.id = "vlr-scraper-ui";
    container.style.cssText = `
      position: fixed;
      right: 16px;
      top: 70px;
      z-index: 999999;
      background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
      border: 1px solid #444;
      border-radius: 12px;
      padding: 20px;
      width: 400px;
      max-height: 85vh;
      overflow-y: auto;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      color: #e0e0e0;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
      display: none;
    `;

    container.innerHTML = `
      <div id="vlr-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;cursor:move;user-select:none;">
        <div style="font-weight:700;font-size:16px;color:#ff4655;">📊 VLR Picks/Bans Scraper</div>
        <button id="scr_close" style="background:none;border:none;color:#999;font-size:20px;cursor:pointer;padding:0;width:24px;height:24px;">×</button>
      </div>
      
      <div style="margin-bottom:12px;">
        <label style="display:block;margin-bottom:4px;font-size:12px;color:#aaa;">URL do Time <span style="color:#ff4655;">*obrigatório</span></label>
        <input id="scr_team" placeholder="https://www.vlr.gg/team/8050/mibr-gc" style="width:100%;padding:8px;background:#1a1a1a;border:1px solid #444;border-radius:6px;color:#e0e0e0;font-size:13px;"/>
      </div>
      
      <div style="margin-bottom:12px;">
        <label style="display:block;margin-bottom:4px;font-size:12px;color:#aaa;">URL do Evento (opcional)</label>
        <input id="scr_event" placeholder="https://www.vlr.gg/event/2617/..." style="width:100%;padding:8px;background:#1a1a1a;border:1px solid #444;border-radius:6px;color:#e0e0e0;font-size:13px;"/>
      </div>
      
      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <div style="flex:1;">
          <label style="display:block;margin-bottom:4px;font-size:12px;color:#aaa;">De</label>
          <input id="scr_from" type="date" style="width:100%;padding:8px;background:#1a1a1a;border:1px solid #444;border-radius:6px;color:#e0e0e0;font-size:13px;"/>
        </div>
        <div style="flex:1;">
          <label style="display:block;margin-bottom:4px;font-size:12px;color:#aaa;">Até</label>
          <input id="scr_to" type="date" style="width:100%;padding:8px;background:#1a1a1a;border:1px solid #444;border-radius:6px;color:#e0e0e0;font-size:13px;"/>
        </div>
      </div>
      
      <div style="margin-bottom:16px;">
        <label style="display:block;margin-bottom:4px;font-size:12px;color:#aaa;">Limite de matches</label>
        <input id="scr_limit" type="number" value="200" style="width:100%;padding:8px;background:#1a1a1a;border:1px solid #444;border-radius:6px;color:#e0e0e0;font-size:13px;"/>
      </div>
      
      <button id="scr_run" style="width:100%;padding:12px;background:linear-gradient(135deg, #ff4655 0%, #ff1744 100%);border:none;border-radius:6px;color:white;font-weight:600;font-size:14px;cursor:pointer;transition:all 0.3s;">
        🚀 Iniciar Scraping
      </button>
      
      <div id="scr_progress" style="margin-top:12px;display:none;padding:8px;background:#2d2d2d;border-radius:6px;font-size:12px;color:#aaa;text-align:center;"></div>
      
      <div id="scr_results" style="margin-top:16px;"></div>
    `;

    document.body.appendChild(container);

    // Toggle modal
    floatingBtn.onclick = () => {
      const isVisible = container.style.display === "block";
      container.style.display = isVisible ? "none" : "block";
    };

    const closeBtn = container.querySelector("#scr_close");
    closeBtn.onclick = () => {
      container.style.display = "none";
    };

    // Drag & drop
    const header = container.querySelector("#vlr-header");
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;

    header.addEventListener("mousedown", (e) => {
      isDragging = true;
      initialX = e.clientX - container.offsetLeft;
      initialY = e.clientY - container.offsetTop;
    });

    document.addEventListener("mousemove", (e) => {
      if (isDragging) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;

        container.style.left = currentX + "px";
        container.style.top = currentY + "px";
        container.style.right = "auto";
      }
    });

    document.addEventListener("mouseup", () => {
      isDragging = false;
    });

    // Run button
    const runBtn = container.querySelector("#scr_run");
    const progress = container.querySelector("#scr_progress");
    const results = container.querySelector("#scr_results");

    runBtn.onclick = async () => {
      const team = container.querySelector("#scr_team").value.trim() || null;
      const event = container.querySelector("#scr_event").value.trim() || null;
      const from = container.querySelector("#scr_from").value.trim();
      const to = container.querySelector("#scr_to").value.trim();
      const lim = parseInt(container.querySelector("#scr_limit").value) || 200;

      if (!team) {
        alert("❌ Por favor, insira a URL do time!");
        return;
      }

      const fromD = from ? new Date(from + "T00:00:00Z") : null;
      const toD = to ? new Date(to + "T23:59:59Z") : null;

      runBtn.disabled = true;
      runBtn.textContent = "⏳ Processando...";
      progress.style.display = "block";
      progress.textContent = "Coletando matches...";
      results.innerHTML = "";

      try {
        const result = await analyzeMatches({
          teamUrl: team,
          eventFilterUrl: event,
          fromDate: fromD,
          toDate: toD,
          maxMatches: lim,
        });

        renderResults(results, result);
        progress.style.display = "none";

        console.log("📊 Resultado completo:", result);
      } catch (err) {
        results.innerHTML = `<div style="color:#ff4655;padding:12px;background:#2d2d2d;border-radius:6px;">❌ Erro: ${err.message}</div>`;
        console.error(err);
        progress.style.display = "none";
      } finally {
        runBtn.disabled = false;
        runBtn.textContent = "🚀 Iniciar Scraping";
      }
    };
  }

  function renderResults(container, result) {
    const {
      teamName,
      teamStats,
      aggregatedByMap,
      detailed,
      filteredOut,
      filters,
    } = result;

    let html = `
      <div style="background:#2d2d2d;padding:12px;border-radius:6px;margin-bottom:16px;">
        <div style="font-weight:700;font-size:16px;color:#ff4655;margin-bottom:8px;">🎯 ${teamName}</div>
        <div style="font-size:13px;color:#aaa;">✅ ${teamStats.matches} séries válidas</div>
        <div style="font-size:11px;color:#666;margin-top:4px;">
          Filtradas: ${filteredOut.event} (evento) + ${filteredOut.noData} (sem dados)
        </div>
    `;

    if (filters.event) {
      html += `<div style="font-size:11px;color:#4caf50;margin-top:4px;">🏆 Evento: ${filters.event}</div>`;
    }
    if (filters.fromDate || filters.toDate) {
      html += `<div style="font-size:11px;color:#2196f3;margin-top:4px;">📅 Período: ${
        filters.fromDate ? filters.fromDate.toISOString().split("T")[0] : "..."
      } até ${
        filters.toDate ? filters.toDate.toISOString().split("T")[0] : "..."
      }</div>`;
    }

    html += `</div>`;

    html += `
      <div style="margin-bottom:20px;">
        <div style="font-weight:600;margin-bottom:8px;color:#ff4655;">📊 Resumo</div>
        <div style="background:#1a1a1a;padding:16px;border-radius:6px;">
          <div style="display:flex;justify-content:space-around;">
            <div style="text-align:center;">
              <div style="font-size:28px;font-weight:700;color:#4caf50;">${teamStats.pick}</div>
              <div style="font-size:12px;color:#aaa;">Picks</div>
            </div>
            <div style="text-align:center;">
              <div style="font-size:28px;font-weight:700;color:#ff4655;">${teamStats.ban}</div>
              <div style="font-size:12px;color:#aaa;">Bans</div>
            </div>
            <div style="text-align:center;">
              <div style="font-size:28px;font-weight:700;color:#2196f3;">${teamStats.matches}</div>
              <div style="font-size:12px;color:#aaa;">Séries</div>
            </div>
          </div>
        </div>
      </div>
    `;

    html += `
      <div style="margin-bottom:20px;">
        <div style="font-weight:600;margin-bottom:8px;color:#ff4655;">🗺️ Composição por Mapa</div>
        <table style="width:100%;border-collapse:collapse;background:#1a1a1a;border-radius:6px;overflow:hidden;">
          <thead>
            <tr style="background:#2d2d2d;">
              <th style="padding:10px;text-align:left;color:#aaa;font-weight:600;font-size:12px;">Mapa</th>
              <th style="padding:10px;text-align:center;color:#4caf50;font-weight:600;font-size:12px;">Picks</th>
              <th style="padding:10px;text-align:center;color:#ff4655;font-weight:600;font-size:12px;">Bans</th>
              <th style="padding:10px;text-align:center;color:#2196f3;font-weight:600;font-size:12px;">Total</th>
            </tr>
          </thead>
          <tbody>
    `;

    const sortedMaps = Object.entries(aggregatedByMap).sort((a, b) => {
      const totalA = a[1].pick + a[1].ban;
      const totalB = b[1].pick + b[1].ban;
      return totalB - totalA;
    });

    for (const [map, stats] of sortedMaps) {
      const total = stats.pick + stats.ban;
      html += `
        <tr style="border-top:1px solid #333;">
          <td style="padding:10px;color:#e0e0e0;font-weight:500;">${map}</td>
          <td style="padding:10px;text-align:center;color:#4caf50;font-weight:600;">${stats.pick}</td>
          <td style="padding:10px;text-align:center;color:#ff4655;font-weight:600;">${stats.ban}</td>
          <td style="padding:10px;text-align:center;color:#2196f3;font-weight:600;">${total}</td>
        </tr>
      `;
    }

    html += `</tbody></table></div>`;

    html += `
      <button id="export_json" style="width:100%;padding:10px;background:#2d2d2d;border:1px solid #444;border-radius:6px;color:#e0e0e0;font-size:13px;cursor:pointer;">
        💾 Exportar JSON
      </button>
    `;

    container.innerHTML = html;

    container.querySelector("#export_json").onclick = () => {
      const dataStr = JSON.stringify(result, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vlr-${teamName.replace(/\s+/g, "-")}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    };
  }

  createUI();
})();
