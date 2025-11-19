/**
 * Funções auxiliares utilizadas em toda a extensão
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithTimeout(url, { timeout = 60000, signal } = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: signal || controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

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
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) throw new Error(`Fetch ${url} falhou: ${res.status}`);
      const html = await res.text();
      const parser = new DOMParser();
      return parser.parseFromString(html, "text/html");
    } catch (e) {
      lastErr = e;
      const wait = 500 * Math.pow(2, attempt) + Math.random() * 300;
      await sleep(wait);
    }
  }
  throw lastErr;
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
        } else if (node.tagName === "SPAN" && !node.classList.contains("tag")) {
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
