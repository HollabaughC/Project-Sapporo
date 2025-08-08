const defaultStoryFile = 'story.json';
let storyPath = defaultStoryFile;
const charactersPath = 'characters.json';
const statsPath = 'stats.json';

let storyData = {};
let charactersData = {};
let statsData = {};
let currentNode = "start";

let typingTimeout;
let isTyping = false;
let skipTyping = false;
let currentFullText = "";

function setCookie(name, value, days = 30) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
}

function getCookie(name) {
  return document.cookie.split('; ').reduce((r, v) => {
    const parts = v.split('=');
    return parts[0] === name ? decodeURIComponent(parts[1]) : r;
  }, '');
}

function deleteCookie(name) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return await res.json();
}

function clampStat(value) {
  return Math.min(20, Math.max(0, value));
}

function clampAffinity(value) {
  return Math.min(100, Math.max(0, value));
}

function updateAffinity(changes) {
  if (!changes) return;
  for (const charId in changes) {
    if (charactersData[charId]) {
      charactersData[charId].affinity = clampAffinity(charactersData[charId].affinity + changes[charId]);
    }
  }
}

function updateStats(changes) {
  if (!changes) return;
  for (const statId in changes) {
    if (statsData[statId]) {
      statsData[statId].value = clampStat(statsData[statId].value + changes[statId]);
    }
  }
}

function canChoose(choice) {
  if (choice.affinityReq) {
    for (const charId in choice.affinityReq) {
      if (!charactersData[charId]) return false;
      if (charactersData[charId].affinity < choice.affinityReq[charId]) return false;
    }
  }
  if (choice.skillReq) {
    for (const statId in choice.skillReq) {
      if (!statsData[statId]) return false;
      if (statsData[statId].value < choice.skillReq[statId]) return false;
    }
  }
  return true;
}

function getCharacterName(charId) {
  if (!charId || charId === "system") return "";
  if (charactersData[charId]) return charactersData[charId].name;
  return "";
}

function renderStats() {
  const statBox = document.getElementById('stats-box');
  statBox.innerHTML = "";
  const statIcons = {
    hacking: "💻",
    persuasion: "🗣️",
    combat: "⚔️",
    stealth: "🕵️",
    tech: "🔧"
  };
  const statColors = {
    hacking: "#5fffd7",
    persuasion: "#ffb347",
    combat: "#ff6b6b",
    stealth: "#9b59b6",
    tech: "#00cec9"
  };
  for (const statId in statsData) {
    const stat = statsData[statId];
    const statLine = document.createElement("div");
    statLine.className = "stat-line";
    statLine.style.borderColor = statColors[statId] || "#888";
    statLine.innerHTML = `
      <span class="stat-icon" style="color: ${statColors[statId] || "#fff"}">${statIcons[statId] || "🔧"}</span>
      <span class="stat-name">${stat.name}</span>
      <span class="stat-value">${stat.value}</span>
    `;
    statBox.appendChild(statLine);
  }
}

async function typeText(element, text, callback) {
  currentFullText = text;
  element.textContent = "";
  isTyping = true;
  skipTyping = false;
  let i = 0;
  function typeChar() {
    if (skipTyping) {
      element.textContent = currentFullText;
      isTyping = false;
      if (callback) callback();
      return;
    }
    if (i < text.length) {
      element.textContent += text[i];
      i++;
      const delay = 15 + Math.random() * 25;
      typingTimeout = setTimeout(typeChar, delay);
    } else {
      isTyping = false;
      if (callback) callback();
    }
  }
  typeChar();
}

async function renderNode(nodeId) {
  clearTimeout(typingTimeout);
  isTyping = false;
  skipTyping = false;
  const node = storyData[nodeId];
  if (!node) return;
  currentNode = nodeId;
  setCookie("storyPath", storyPath);
  setCookie("currentNode", currentNode);
  const lastLine = node.lines[node.lines.length - 1];
  const charName = getCharacterName(lastLine.character);
  const dialogueText = lastLine.text;
  document.getElementById('character-name').textContent = charName;
  const dialogueElement = document.getElementById('dialogue-text');
  const buttons = [
    document.getElementById('choice1'),
    document.getElementById('choice2'),
    document.getElementById('choice3')
  ];
  buttons.forEach(btn => btn.style.display = 'none');
  if (node.choices && node.choices.length > 0) {
    for (let i = 0; i < 3; i++) {
      const choice = node.choices[i];
      if (!choice) continue;
      const allowed = canChoose(choice);
      const btn = buttons[i];
      btn.style.display = 'flex';
      btn.disabled = !allowed;
      let btnText = choice.text;
      const reqs = [];
      if (choice.affinityReq) {
        for (const [charId, val] of Object.entries(choice.affinityReq)) {
          reqs.push(`${getCharacterName(charId)} ≥ ${val}`);
        }
      }
      if (choice.skillReq) {
        for (const [statId, val] of Object.entries(choice.skillReq)) {
          reqs.push(`${statsData[statId]?.name || statId} ≥ ${val}`);
        }
      }
      if (reqs.length > 0) {
        btn.innerHTML = `<span>${btnText}</span><span class="affinity-requirement">${reqs.join(", ")}</span>`;
      } else {
        btn.textContent = btnText;
      }
      btn.dataset.next = choice.next || "";
      btn.onclick = async (event) => {
        event.stopPropagation();
        clearTimeout(typingTimeout);
        isTyping = false;
        skipTyping = false;
        updateAffinity(choice.affinityChange);
        updateStats(choice.skillChange);
        if (choice.next && choice.next.endsWith(".json")) {
          storyPath = choice.next;
          storyData = await loadJSON(storyPath);
          renderNode("start");
          renderStats();
        } else {
          renderNode(choice.next);
          renderStats();
        }
      };
    }
  }
  typeText(dialogueElement, dialogueText);
}

document.addEventListener("click", (event) => {
  const isChoiceButton = event.target.closest("#choice1, #choice2, #choice3");
  if (!isChoiceButton && isTyping) {
    skipTyping = true;
    clearTimeout(typingTimeout);
    document.getElementById('dialogue-text').textContent = currentFullText;
    isTyping = false;
  }
});

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("clear-save").addEventListener("click", () => {
    deleteCookie("storyPath");
    deleteCookie("currentNode");
    location.reload();
  });
});

async function init() {
  try {
    const savedStory = getCookie("storyPath");
    const savedNode = getCookie("currentNode");
    storyPath = savedStory || defaultStoryFile;
    [storyData, charactersData, statsData] = await Promise.all([
      loadJSON(storyPath),
      loadJSON(charactersPath),
      loadJSON(statsPath)
    ]);
    if (savedNode && storyData[savedNode]) {
      renderNode(savedNode);
    } else {
      renderNode(currentNode);
    }
    renderStats();
  } catch (err) {
    console.error(err);
    document.getElementById('dialogue-text').textContent = "Failed to load game data.";
  }
}

init();
