/**
 * Lógica de scraping de matches e picks/bans
 */

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

async function fetchAllMatchesPages(baseUrl, maxMatches) {
  const allMatches = [];

  console.log("📄 Buscando página 1...");
  const firstPageDoc = await fetchDoc(baseUrl);
  const firstPageMatches = extractMatchesFromContainer(firstPageDoc);
  allMatches.push(...firstPageMatches);

  const totalPages = getMaxPage(firstPageDoc);
  console.log(`📚 Total de páginas detectadas: ${totalPages}\n`);

  if (totalPages > 1) {
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

        await new Promise((res) => setTimeout(res, 500));
      } catch (err) {
        console.warn(`   ⚠️ Erro ao buscar página ${page}: ${err.message}\n`);
      }
    }
  }

  return allMatches;
}

async function navigateToMatchesTab(teamUrl) {
  const u = new URL(teamUrl, "https://www.vlr.gg");
  const m = u.pathname.match(/\/team\/(\d+)\/([^/?#]+)/);
  if (!m) throw new Error("URL do time inválida");

  const teamId = m[1];
  const teamSlug = m[2];
  return `https://www.vlr.gg/team/matches/${teamId}/${teamSlug}?group=completed`;
}

function extractMatchesFromContainer(doc) {
  const matches = [];
  const matchCards = doc.querySelectorAll(".wf-card.fc-flex.m-item");

  for (const card of matchCards) {
    const linkEl = card.tagName === "A" ? card : card.querySelector("a[href]");

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

  const eventLinkEl = doc.querySelector('a.match-header-event[href^="/event"]');

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

  const candidates = Array.from(
    doc.querySelectorAll(
      ".match-veto, .m-veto, .veto, .match-header-note, .match-header-vs-note"
    )
  );
  for (const el of candidates) {
    const t = (el.textContent || "").toLowerCase();
    if (t.includes("pick") || t.includes("ban") || t.includes("veto")) {
      pickBanString = (el.textContent || "").trim();
      if (pickBanString) break;
    }
  }

  if (!pickBanString) {
    const paragraphs = Array.from(
      doc.querySelectorAll(
        "p, div.match-header-note, div.match-header-vs-note, .match-header-vs-note"
      )
    );
    for (const p of paragraphs) {
      const text = p.textContent || "";
      const lower = text.toLowerCase();
      if (
        (lower.includes("ban") || lower.includes("veto")) &&
        lower.includes("pick")
      ) {
        pickBanString = text.trim();
        break;
      }
    }
  }

  if (!pickBanString) {
    const allText = doc.body.textContent || "";
    const lines = allText.split("\n");
    for (const line of lines) {
      const lower = line.toLowerCase();
      if (
        (lower.includes("pick") ||
          lower.includes("ban") ||
          lower.includes("veto")) &&
        line.includes(";")
      ) {
        pickBanString = line.trim();
        break;
      }
    }
  }

  if (!pickBanString) return null;

  const actions = [];
  const parts = pickBanString.split(/[;,]/).map((s) => s.trim());

  for (const part of parts) {
    const normalized = part.replace(/\bveto\b/gi, "ban");
    const match = normalized.match(/(.*?)\s+(ban|pick)\s+(.*)/i);
    if (match) {
      let team = match[1].trim();
      const action = match[2].toLowerCase();
      let map = match[3].trim();

      team = team.replace(/\./g, " ").replace(/\s+/g, " ");
      map = map.charAt(0).toUpperCase() + map.slice(1).toLowerCase();

      if (teamMatches(team, filterTeamName)) {
        actions.push({ team, action, map });
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

  console.log("📥 Acessando página do time:", teamUrl);
  const teamDoc = await fetchDoc(teamUrl);

  const teamName = extractTeamNameFromPage(teamDoc);
  if (!teamName) {
    throw new Error("❌ Não foi possível extrair o nome do time");
  }
  console.log(`✅ Time identificado: "${teamName}"\n`);

  const matchesUrl = await navigateToMatchesTab(teamUrl);

  const matchList = await fetchAllMatchesPages(matchesUrl, maxMatches);

  if (matchList.length === 0) {
    throw new Error("❌ Nenhum match encontrado");
  }

  console.log(`📋 Total de matches coletados: ${matchList.length}\n`);

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
        `   De: ${fromDate ? fromDate.toISOString().split("T")[0] : "qualquer"}`
      );
      console.log(
        `   Até: ${toDate ? toDate.toISOString().split("T")[0] : "qualquer"}\n`
      );
    }
  }

  const toProcess = filteredByDate.slice(0, maxMatches);
  console.log(
    `📊 Processando ${toProcess.length} matches (limite: ${maxMatches})\n`
  );

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
