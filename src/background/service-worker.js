/**
 * Background Service Worker
 * Gerencia eventos em segundo plano da extensão
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log("VLR Picks/Bans Scraper instalado com sucesso! 🎮");
});

// Listener para mensagens de outros componentes
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getData") {
    // Exemplo de comunicação entre componentes
    sendResponse({ success: true });
  }
  return true;
});
