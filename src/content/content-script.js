/**
 * Content Script - Injeta UI e controla scraping
 */

(function () {
  "use strict";

  let currentAbortController = null;
  let dragging = false;
  let offsetX = 0,
    offsetY = 0;

  function createUI() {
    const container = document.createElement("div");
    container.id = "vlr-scraper-ui";
    container.style.display = "none";
    container.innerHTML = `
      <div id="vlr-scraper-header">
        <span>🎮 VLR Scraper</span>
        <button id="vlr-scraper-close" title="Fechar">✖</button>
      </div>
      
      <div id="vlr-scraper-body">
        <div class="vlr-form-group">
          <label>URL do Time:</label>
          <input type="text" id="vlr-team-url" placeholder="https://www.vlr.gg/team/..." />
        </div>

        <div class="vlr-form-group">
          <label>URL do Evento (opcional):</label>
          <input type="text" id="vlr-event-url" placeholder="https://www.vlr.gg/event/..." />
        </div>

        <div class="vlr-form-row">
          <div class="vlr-form-group">
            <label>Data Inicial:</label>
            <input type="date" id="vlr-from-date" />
          </div>
          <div class="vlr-form-group">
            <label>Data Final:</label>
            <input type="date" id="vlr-to-date" />
          </div>
        </div>

        <div class="vlr-form-group">
          <label title="Máximo de séries a percorrer no histórico do time cronologicamente" >Máx. de Séries (busca):</label>
          <input type="number" id="vlr-max-matches" value="100" min="1" max="500" />
        </div>

        <div class="vlr-actions">
          <button id="vlr-scraper-start" class="vlr-btn-primary">🚀 Iniciar</button>
          <button id="vlr-scraper-stop" class="vlr-btn-danger" style="display:none">⏹️ Parar</button>
          <button id="vlr-scraper-clear">🗑️ Limpar</button>
        </div>

        <div id="vlr-scraper-status"></div>
        <div id="vlr-scraper-output"></div>
      </div>
    `;

    document.body.appendChild(container);

    // Drag & Drop
    const header = container.querySelector("#vlr-scraper-header");
    header.addEventListener("mousedown", (e) => {
      if (e.target.id === "vlr-scraper-close") return;
      dragging = true;
      offsetX = e.clientX - container.offsetLeft;
      offsetY = e.clientY - container.offsetTop;
      header.style.setProperty("cursor", "grabbing", "important");
    });

    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      container.style.left = `${e.clientX - offsetX}px`;
      container.style.top = `${e.clientY - offsetY}px`;
    });

    document.addEventListener("mouseup", () => {
      if (dragging) {
        dragging = false;
        header.style.setProperty("cursor", "grab", "important");
      }
    });

    // Botões
    document
      .getElementById("vlr-scraper-close")
      .addEventListener("click", () => {
        container.style.display = "none";
      });

    document
      .getElementById("vlr-scraper-start")
      .addEventListener("click", startScraping);

    document
      .getElementById("vlr-scraper-stop")
      .addEventListener("click", stopScraping);

    document
      .getElementById("vlr-scraper-clear")
      .addEventListener("click", clearForm);

    // Persistência imediata ao digitar/alterar campos
    const $team = document.getElementById("vlr-team-url");
    const $event = document.getElementById("vlr-event-url");
    const $from = document.getElementById("vlr-from-date");
    const $to = document.getElementById("vlr-to-date");
    const $max = document.getElementById("vlr-max-matches");

    const persist = () =>
      saveFormState({
        teamUrl: ($team.value || "").trim(),
        eventUrl: ($event.value || "").trim(),
        fromDate: $from.value || "",
        toDate: $to.value || "",
        maxMatches: parseInt($max.value, 10) || 100,
      });

    [$team, $event, $max].forEach((el) => {
      el.addEventListener("input", persist);
      el.addEventListener("change", persist);
    });
    [$from, $to].forEach((el) => {
      el.addEventListener("change", persist);
      el.addEventListener("input", persist);
    });

    // Carregar estado salvo
    loadSavedState();
  }

  function loadSavedState() {
    const state = loadFormState();
    if (!state) return;

    const teamUrl = document.getElementById("vlr-team-url");
    const eventUrl = document.getElementById("vlr-event-url");
    const fromDate = document.getElementById("vlr-from-date");
    const toDate = document.getElementById("vlr-to-date");
    const maxMatches = document.getElementById("vlr-max-matches");

    if (state.teamUrl) teamUrl.value = state.teamUrl;
    if (state.eventUrl) eventUrl.value = state.eventUrl;
    if (state.fromDate) fromDate.value = state.fromDate;
    if (state.toDate) toDate.value = state.toDate;
    if (state.maxMatches) maxMatches.value = state.maxMatches;
  }

  function clearForm() {
    document.getElementById("vlr-team-url").value = "";
    document.getElementById("vlr-event-url").value = "";
    document.getElementById("vlr-from-date").value = "";
    document.getElementById("vlr-to-date").value = "";
    document.getElementById("vlr-max-matches").value = "100";
    document.getElementById("vlr-scraper-output").innerHTML = "";
    document.getElementById("vlr-scraper-status").innerHTML = "";
    clearFormState();
  }

  async function startScraping() {
    const teamUrl = document.getElementById("vlr-team-url").value.trim();
    const eventUrl = document.getElementById("vlr-event-url").value.trim();
    const fromDateStr = document.getElementById("vlr-from-date").value;
    const toDateStr = document.getElementById("vlr-to-date").value;
    const maxMatches =
      parseInt(document.getElementById("vlr-max-matches").value) || 100;

    if (!teamUrl) {
      alert("❌ Por favor, insira a URL do time!");
      return;
    }

    // Salvar estado
    saveFormState({
      teamUrl,
      eventUrl,
      fromDate: fromDateStr,
      toDate: toDateStr,
      maxMatches,
    });

    const fromDate = fromDateStr ? new Date(fromDateStr + "T00:00:00Z") : null;
    const toDate = toDateStr ? new Date(toDateStr + "T23:59:59Z") : null;

    const statusEl = document.getElementById("vlr-scraper-status");
    const outputEl = document.getElementById("vlr-scraper-output");

    statusEl.innerHTML = '<div class="vlr-loading">⏳ Carregando...</div>';
    outputEl.innerHTML = "";

    document.getElementById("vlr-scraper-start").style.display = "none";
    document.getElementById("vlr-scraper-stop").style.display = "inline-block";

    currentAbortController = new AbortController();

    try {
      const result = await analyzeMatches({
        teamUrl,
        eventFilterUrl: eventUrl || null,
        fromDate,
        toDate,
        maxMatches,
      });

      displayResults(result);
      statusEl.innerHTML = '<div class="vlr-success">✅ Concluído!</div>';
    } catch (err) {
      statusEl.innerHTML = `<div class="vlr-error">❌ Erro: ${err.message}</div>`;
      console.error("Erro no scraping:", err);
    } finally {
      document.getElementById("vlr-scraper-start").style.display =
        "inline-block";
      document.getElementById("vlr-scraper-stop").style.display = "none";
      currentAbortController = null;
    }
  }

  function stopScraping() {
    if (currentAbortController) {
      currentAbortController.abort();
      const statusEl = document.getElementById("vlr-scraper-status");
      statusEl.innerHTML = '<div class="vlr-warning">⚠️ Cancelado</div>';
    }
  }

  function displayResults(result) {
    const outputEl = document.getElementById("vlr-scraper-output");

    let html = `
      <div class="vlr-results">
        <h3>📊 Resultados para ${result.teamName}</h3>
        
        <div class="vlr-stats">
          <h4>Estatísticas Gerais:</h4>
          <p>🎮 Séries analisadas: <strong>${result.teamStats.matches}</strong></p>
          <p>✅ Picks: <strong>${result.teamStats.pick}</strong></p>
          <p>❌ Bans: <strong>${result.teamStats.ban}</strong></p>
        </div>

        <div class="vlr-maps">
          <h4>Por Mapa:</h4>
          <table>
            <thead>
              <tr>
                <th>Mapa</th>
                <th>Picks</th>
                <th>Bans</th>
                <th>Ban Rate</th>
              </tr>
            </thead>
            <tbody>
    `;

    const totalSeries = Math.max(1, result.teamStats?.matches || 0);
    for (const [map, stats] of Object.entries(result.aggregatedByMap)) {
      const banRate = ((stats.ban / totalSeries) * 100).toFixed(1);
      html += `
        <tr>
          <td>${map}</td>
          <td class="vlr-pick">${stats.pick}</td>
          <td class="vlr-ban">${stats.ban}</td>
          <td class="vlr-banrate" title="Bans / Séries">${banRate}%</td>
        </tr>
      `;
    }

    html += `
            </tbody>
          </table>
        </div>

        <div class="vlr-detailed">
          <h4>Séries Detalhadas:</h4>
    `;

    for (const match of result.detailed) {
      const dateStr = match.date
        ? match.date.toISOString().split("T")[0]
        : "N/A";
      html += `
        <div class="vlr-match">
          <div class="vlr-match-header">
            <strong>${match.event}</strong> - ${dateStr}
          </div>
          <div class="vlr-match-actions">
            ${match.actions
              .map(
                (a) =>
                  `<span class="vlr-action-${
                    a.action
                  }">${a.action.toUpperCase()}: ${a.map}</span>`
              )
              .join(" ")}
          </div>
          <a href="${
            match.url
          }" target="_blank" class="vlr-match-link">🔗 Ver match</a>
        </div>
      `;
    }

    html += `
        </div>
        
        <button id="vlr-export-json" class="vlr-btn-secondary">💾 Exportar JSON</button>
      </div>
    `;

    outputEl.innerHTML = html;

    document.getElementById("vlr-export-json").addEventListener("click", () => {
      const dataStr = JSON.stringify(result, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vlr-scraper-${result.teamName}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // Inicializar
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createUI);
  } else {
    createUI();
  }

  // Atalho de teclado: Ctrl+Shift+V
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === "V") {
      const container = document.getElementById("vlr-scraper-ui");
      if (container) {
        container.style.display =
          container.style.display === "none" ? "block" : "none";
      }
    }
  });
})();
