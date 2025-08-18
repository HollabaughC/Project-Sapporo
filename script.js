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

function saveProgress() {
  setCookie("storyPath", storyPath);
  setCookie("currentNode", currentNode);
  setCookie("charactersData", JSON.stringify(charactersData));
  setCookie("statsData", JSON.stringify(statsData));
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

  const jpChars = "牛乳製品奶油脂肪酪農ミルクアイスリームチズヨグトバタショケキプンラテカド";
  let i = 0;

  function typeChar() {
    if (skipTyping) {
      element.textContent = currentFullText;
      isTyping = false;
      if (callback) callback();
      return;
    }

    if (i < text.length) {
      let flashes = 0;
      const maxFlashes = 1;

      function flashChar() {
        if (flashes < maxFlashes) {
          let randomCluster = "";
          for (let j = 0; j < 1; j++) {
            randomCluster += jpChars.charAt(Math.floor(Math.random() * jpChars.length));
          }
          element.textContent = element.textContent.slice(0, i) + randomCluster;
          flashes++;
          setTimeout(flashChar, 40);
        } else {
          element.textContent = element.textContent.slice(0, i) + text[i];
          i++;
          const delay = 3 + Math.random() * 1;
          typingTimeout = setTimeout(typeChar, delay);
        }
      }

      if (element.textContent.length < i + 5) {
        element.textContent += " ".repeat(5);
      }

      flashChar();

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
  saveProgress();

  const lastLine = node.lines[node.lines.length - 1];
  const charId = lastLine.character;
  const charName = getCharacterName(charId);
  const dialogueText = lastLine.text;

  const nameElement = document.getElementById('character-name');
  const imageElement = document.getElementById('character-image');

  nameElement.textContent = charName;

  if (charId && charactersData[charId] && charactersData[charId].image) {
    imageElement.src = charactersData[charId].image;
    imageElement.style.display = 'inline-block';

    const fontSize = parseFloat(window.getComputedStyle(nameElement).fontSize);
    imageElement.style.height = `${fontSize * 3}px`;
    imageElement.style.width = 'auto';
  } else {
    imageElement.style.display = 'none';
    imageElement.src = '';
  }

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
      btn.onclick = async (event) => {
        event.stopPropagation();
        clearTimeout(typingTimeout);
        isTyping = false;
        skipTyping = false;
        updateAffinity(choice.affinityChange);
        updateStats(choice.skillChange);
        saveProgress();
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
    deleteCookie("charactersData");
    deleteCookie("statsData");
    location.reload();
  });
});

async function init() {
  try {
    const savedStory = getCookie("storyPath");
    const savedNode = getCookie("currentNode");
    const savedCharactersData = getCookie("charactersData");
    const savedStatsData = getCookie("statsData");

    storyPath = savedStory || defaultStoryFile;

    [storyData, charactersData, statsData] = await Promise.all([
      loadJSON(storyPath),
      loadJSON(charactersPath),
      loadJSON(statsPath)
    ]);

    if (savedCharactersData) {
      charactersData = JSON.parse(savedCharactersData);
    }
    if (savedStatsData) {
      statsData = JSON.parse(savedStatsData);
    }

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

const canvas = document.getElementById("particle-bg");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const particles = Array.from({ length: 60 }, () => ({
  x: Math.random() * canvas.width,
  y: Math.random() * canvas.height,
  r: Math.random() * 2 + 1,
  dx: (Math.random() - 0.5) * 0.5,
  dy: (Math.random() - 0.5) * 0.5,
  color: `hsl(${Math.random()*360}, 100%, 50%)`
}));

function animateParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles.forEach(p => {
    p.x += p.dx;
    p.y += p.dy;

    if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
    if (p.y < 0 || p.y > canvas.height) p.dy *= -1;

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 8;
    ctx.fill();
  });
  requestAnimationFrame(animateParticles);
}
animateParticles();

window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

init();
