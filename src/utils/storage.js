/**
 * Gerenciamento de armazenamento de dados da extensão
 */

const STORAGE_KEY = "vlr-scraper.form";

function loadFormState() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveFormState(partial) {
  try {
    const prev = loadFormState() || {};
    const next = { ...prev, ...partial, _ts: Date.now() };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (e) {
    console.error("Erro ao salvar estado do formulário:", e);
  }
}

function clearFormState() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error("Erro ao limpar estado do formulário:", e);
  }
}
