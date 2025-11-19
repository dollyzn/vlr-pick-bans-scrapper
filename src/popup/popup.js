document.getElementById("open-vlr").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://www.vlr.gg" });
});
