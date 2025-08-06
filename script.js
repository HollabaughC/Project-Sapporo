const storyPath = 'story.json';
const charactersPath = 'characters.json';
const statsPath = 'stats.json';

let storyData = {};
let charactersData = {};
let statsData = {};
let currentNode = "start";

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return await res.json();
}

function clampStat(value) {
  return Math.min(20, Math.max(0, value));
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

function renderNode(nodeId) {
  const node = storyData[nodeId];
  if (!node) return;

  currentNode = nodeId;

  const lastLine = node.lines[node.lines.length - 1];
  const charName = getCharacterName(lastLine.character);
  const dialogueText = lastLine.text;

  document.getElementById('character-name').textContent = charName;
  document.getElementById('dialogue-text').textContent = dialogueText;

  const buttons = [
    document.getElementById('choice1'),
    document.getElementById('choice2'),
    document.getElementById('choice3')
  ];

  buttons.forEach(btn => {
    btn.disabled = true;
    btn.textContent = "";
    btn.dataset.next = "";
    btn.innerHTML = "";
    btn.style.display = 'none';
  });

  if (!node.choices || node.choices.length === 0) {
    return;
  }

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
    btn.onclick = () => {
      updateAffinity(choice.affinityChange);
      updateStats(choice.skillChange);
      renderNode(choice.next);
      renderStats();
    };
  }
}

async function init() {
  try {
    [storyData, charactersData, statsData] = await Promise.all([
      loadJSON(storyPath),
      loadJSON(charactersPath),
      loadJSON(statsPath)
    ]);
    renderNode(currentNode);
    renderStats();
  } catch (err) {
    console.error(err);
    document.getElementById('dialogue-text').textContent = "Failed to load game data.";
  }
}

init();
