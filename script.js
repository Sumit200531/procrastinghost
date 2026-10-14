/*
 * Procrastinghost
 * ACM Long Beach Spooky Season Hackathon
 *
 * Idea: a to-do list where every task you ignore turns into a ghost.
 * The longer you ignore it, the higher its "haunt level" gets (1 to 4).
 * Higher level = bigger ghost, faster, meaner messages.
 * Only way to remove a ghost is to mark the task done.
 */

// ------------------------------------------------------------
// Constants
// ------------------------------------------------------------

const STORAGE_KEY = "procrastinghost";
const MAX_LEVEL = 4;

// Info for each haunt level. Index 0 is empty because level 0 = not a ghost yet.
const LEVELS = [
  null,
  {
    name: "Level 1 · Mildly spooky",
    color: "#c9f5e6",
    messages: [
      "hey. remember '{task}'? no pressure.",
      "just floating by. '{task}' says hi.",
      "boo. (it's about '{task}')"
    ]
  },
  {
    name: "Level 2 · Per my last haunting",
    color: "#ffd27a",
    messages: [
      "per my last haunting, '{task}'.",
      "just circling back on '{task}'.",
      "friendly reminder, '{task}' is still a thing."
    ]
  },
  {
    name: "Level 3 · Not mad, just disappointed",
    color: "#ff8a3d",
    messages: [
      "i'm not mad. i'm just disappointed. '{task}'.",
      "your ancestors are watching you skip '{task}'.",
      "i've rewritten my will. '{task}' gets everything."
    ]
  },
  {
    name: "Level 4 · Full poltergeist",
    color: "#ff5470",
    messages: [
      "i have been dead for less time than '{task}' has been pending",
      "'{task}'. now.",
      "i will rattle every chain i own over '{task}'"
    ]
  }
];

// [what you say, what the ghost says back]
const EXCUSES = [
  ["I'll do it after one more episode.", "The ghost has seen you say this 41 times. It grows."],
  ["Mercury is in retrograde.", "The ghost checked. Mercury is fine. It grows."],
  ["I work better under pressure.", "Great. Here is some pressure. It grows."],
  ["I need to find the perfect pen first.", "The ghost hands you a pen. It grows anyway."],
  ["It's not due until tomorrow.", "Tomorrow-you has filed a formal complaint. It grows."],
  ["I'm waiting for inspiration.", "Inspiration is also dead. They are friends now. It grows."]
];

// ------------------------------------------------------------
// State
// ------------------------------------------------------------

let appData = {
  tasks: [],
  exorcisedCount: 0,
  excuseCount: 0
};

// taskId -> ghost object (the DOM element + position + speed)
const activeGhosts = new Map();

let selectedTaskId = null; // which task the popup is showing
let toastTimer = null;

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ------------------------------------------------------------
// Helper functions
// ------------------------------------------------------------

function getElement(id) {
  return document.getElementById(id);
}

function generateId() {
  return Math.random().toString(36).slice(2);
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// turns milliseconds into "1:05" or "2h 03m"
function formatTimeLeft(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return hours + "h " + String(minutes).padStart(2, "0") + "m";
  }
  return minutes + ":" + String(seconds).padStart(2, "0");
}

// so users can't inject html through task names
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function findTask(taskId) {
  return appData.tasks.find(task => task.id === taskId);
}

// ------------------------------------------------------------
// Saving / loading (localStorage)
// ------------------------------------------------------------

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
  } catch (error) {
    // storage can be blocked in private mode, app still works without it
    console.warn("Could not save:", error);
  }
}

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      appData = JSON.parse(saved);
      return true;
    }
  } catch (error) {
    console.warn("Could not load:", error);
  }
  return false;
}

// Sample tasks for first time users so the page isn't empty
function addExampleTasks() {
  const currentTime = Date.now();
  const thirtySeconds = 30 * 1000;

  function makeExample(text, startsHauntingIn) {
    return {
      id: generateId(),
      text: text,
      hauntAt: currentTime + startsHauntingIn,
      levelUpEvery: thirtySeconds,
      excuses: 0,
      done: false,
      isExample: true
    };
  }

  appData.tasks = [
    makeExample("Finish my ACM hackathon project", -100000), // already level 4
    makeExample("Do laundry (week 3)", -40000),
    makeExample("Text mom back", -5000),
    makeExample("Read DSA chapter 4", 25000)                // not haunting yet
  ];
}

// ------------------------------------------------------------
// Haunt level logic
// ------------------------------------------------------------

// level 0 = still alive, 1-4 = ghost
function getHauntLevel(task) {
  if (task.done) return 0;

  const currentTime = Date.now();
  if (currentTime < task.hauntAt) return 0;

  const timeOverdue = currentTime - task.hauntAt;
  const levelFromTime = 1 + Math.floor(timeOverdue / task.levelUpEvery);

  // every excuse/snooze adds +1 level as punishment
  return Math.min(MAX_LEVEL, levelFromTime + task.excuses);
}

// ------------------------------------------------------------
// Ghost drawing (SVG)
// ------------------------------------------------------------

// Eyes and mouth get angrier with each level
const GHOST_EYES = [
  "",
  "<ellipse cx='38' cy='44' rx='6' ry='8'/><ellipse cx='62' cy='44' rx='6' ry='8'/>",
  "<rect x='31' y='42' width='14' height='6' rx='3'/><rect x='55' y='42' width='14' height='6' rx='3'/>",
  "<path d='M30 38 L46 44 L30 48Z'/><path d='M70 38 L54 44 L70 48Z'/>",
  "<path d='M28 34 L48 46 L30 50Z'/><path d='M72 34 L52 46 L70 50Z'/>" +
    "<circle cx='38' cy='45' r='2' fill='#ff5470'/><circle cx='62' cy='45' r='2' fill='#ff5470'/>"
];

const GHOST_MOUTHS = [
  "",
  "<ellipse cx='50' cy='62' rx='5' ry='6'/>",
  "<path d='M40 64 L60 64' stroke='#1b1626' stroke-width='4' stroke-linecap='round'/>",
  "<path d='M38 68 Q50 58 62 68' stroke='#1b1626' stroke-width='4' fill='none' stroke-linecap='round'/>",
  "<path d='M34 60 L66 60 L62 74 L38 74Z'/>" +
    "<path d='M40 60 L43 66 L46 60 L49 66 L52 60 L55 66 L58 60' fill='#efe6d8'/>"
];

function buildGhostSvg(level) {
  const bodyColor = LEVELS[level].color;
  const bodyShape = "M50 6 C24 6 12 26 12 50 L12 100 L22 90 L32 102 L42 90 L50 102 " +
                    "L58 90 L68 102 L78 90 L88 100 L88 50 C88 26 76 6 50 6Z";

  return `
    <svg viewBox="0 0 100 110">
      <path d="${bodyShape}" fill="${bodyColor}"/>
      <g fill="#1b1626">${GHOST_EYES[level]}${GHOST_MOUTHS[level]}</g>
    </svg>`;
}

// ------------------------------------------------------------
// Creating / updating / removing ghosts on screen
// ------------------------------------------------------------

function createGhost(task, size) {
  const ghostElement = document.createElement("div");
  ghostElement.className = "ghost";
  ghostElement.innerHTML = `<div class="speech-bubble"></div><div class="ghost-body"></div>`;
  ghostElement.addEventListener("click", () => openPopup(task.id));
  getElement("ghost-layer").appendChild(ghostElement);

  // start at a random spot moving in a random direction
  const angle = Math.random() * Math.PI * 2;

  const ghost = {
    element: ghostElement,
    x: Math.random() * (window.innerWidth - size),
    y: Math.random() * (window.innerHeight - size),
    directionX: Math.cos(angle),
    directionY: Math.sin(angle),
    level: 0,
    size: size,
    nextTalkTime: Date.now() + 1000 + Math.random() * 4000,
    isLeaving: false
  };

  activeGhosts.set(task.id, ghost);
  return ghost;
}

function removeGhost(taskId) {
  const ghost = activeGhosts.get(taskId);
  if (ghost && !ghost.isLeaving) {
    ghost.element.remove();
    activeGhosts.delete(taskId);
  }
}

// Makes sure every overdue task has a ghost and the ghost matches its level
function updateGhosts() {
  const screenSize = Math.min(window.innerWidth, window.innerHeight);

  for (const task of appData.tasks) {
    const level = getHauntLevel(task);

    if (level === 0) {
      removeGhost(task.id);
      continue;
    }

    // ghost size grows with level, but never more than 40% of the screen
    const size = Math.min(60 + level * 26, screenSize * 0.4);

    let ghost = activeGhosts.get(task.id);
    if (!ghost) {
      ghost = createGhost(task, size);
    }

    // only redraw the svg when the level actually changes
    if (ghost.level !== level) {
      ghost.level = level;
      ghost.element.className = "ghost level-" + level;
      ghost.element.style.setProperty("--glow-color", LEVELS[level].color + "88");
      ghost.element.querySelector(".ghost-body").innerHTML = buildGhostSvg(level);
    }

    ghost.size = size;
    ghost.element.style.width = size + "px";
    ghost.element.style.height = size * 1.1 + "px";
  }

  // clean up ghosts for tasks that got deleted
  for (const taskId of activeGhosts.keys()) {
    const task = findTask(taskId);
    if (!task || task.done) {
      removeGhost(taskId);
    }
  }

  // red screen effect if any ghost is level 4
  const hasPoltergeist = [...activeGhosts.values()].some(ghost => ghost.level === MAX_LEVEL);
  document.body.classList.toggle("poltergeist-mode", hasPoltergeist);
}

// ------------------------------------------------------------
// Animation loop (moves ghosts + speech bubbles)
// ------------------------------------------------------------

let lastFrameTime = performance.now();

function animateGhosts(frameTime) {
  // seconds since last frame (capped so ghosts don't teleport after tab switch)
  const deltaTime = Math.min(50, frameTime - lastFrameTime) / 1000;
  lastFrameTime = frameTime;

  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  const currentTime = Date.now();

  for (const [taskId, ghost] of activeGhosts) {
    if (ghost.isLeaving) continue;

    // angrier ghosts move faster
    const speed = prefersReducedMotion ? 12 : 30 + ghost.level * 28;
    ghost.x += ghost.directionX * speed * deltaTime;
    ghost.y += ghost.directionY * speed * deltaTime;

    // bounce off the edges of the screen
    const maxX = screenWidth - ghost.size;
    const maxY = screenHeight - ghost.size * 1.1;
    const minY = 40;

    if (ghost.x < 0) { ghost.x = 0; ghost.directionX = Math.abs(ghost.directionX); }
    if (ghost.x > maxX) { ghost.x = maxX; ghost.directionX = -Math.abs(ghost.directionX); }
    if (ghost.y < minY) { ghost.y = minY; ghost.directionY = Math.abs(ghost.directionY); }
    if (ghost.y > maxY) { ghost.y = maxY; ghost.directionY = -Math.abs(ghost.directionY); }

    ghost.element.style.transform = `translate(${ghost.x}px, ${ghost.y}px)`;

    // time for the ghost to say something?
    if (currentTime > ghost.nextTalkTime) {
      showSpeechBubble(taskId, ghost);
      // higher level ghosts talk more often
      ghost.nextTalkTime = currentTime + (9000 - ghost.level * 1500) + Math.random() * 5000;
    }
  }

  requestAnimationFrame(animateGhosts);
}

function showSpeechBubble(taskId, ghost) {
  const task = findTask(taskId);
  if (!task) return;

  const bubble = ghost.element.querySelector(".speech-bubble");
  const message = pickRandom(LEVELS[ghost.level].messages);

  bubble.textContent = message.replace("{task}", task.text);
  bubble.classList.add("visible");
  setTimeout(() => bubble.classList.remove("visible"), 3800);
}

// ------------------------------------------------------------
// Rendering the task lists
// ------------------------------------------------------------

function renderTaskLists() {
  const aliveRows = [];
  const hauntedRows = [];
  const graveyardRows = [];

  for (const task of appData.tasks) {
    const level = getHauntLevel(task);
    const exampleTag = task.isExample ? '<span class="example-tag">example</span>' : "";
    const safeText = escapeHtml(task.text);

    if (task.done) {
      graveyardRows.push(`<li>${safeText}</li>`);
    } else if (level === 0) {
      const timeLeft = formatTimeLeft(task.hauntAt - Date.now());
      aliveRows.push(`
        <li class="task-row">
          <span class="task-text">${safeText}${exampleTag}</span>
          <span class="timer">haunts in ${timeLeft}</span>
          <button class="btn-outline" data-done-id="${task.id}" type="button">Done</button>
        </li>`);
    } else {
      hauntedRows.push({
        level: level,
        html: `
          <li class="task-row haunted" style="--level-color: ${LEVELS[level].color}">
            <span class="task-text">${safeText}${exampleTag}</span>
            <span class="level-badge">LV ${level}</span>
            <button class="btn-outline" data-open-id="${task.id}" type="button">Face it</button>
          </li>`
      });
    }
  }

  // scariest ghosts at the top
  hauntedRows.sort((a, b) => b.level - a.level);

  getElement("alive-list").innerHTML = aliveRows.join("") ||
    '<li class="empty-message">Nothing alive. Either you are very productive or everything is already dead.</li>';

  getElement("haunted-list").innerHTML = hauntedRows.map(row => row.html).join("") ||
    '<li class="empty-message">No ghosts. Suspicious.</li>';

  // only show the last 8 finished tasks, newest first
  getElement("graveyard-list").innerHTML = graveyardRows.slice(-8).reverse().join("") ||
    '<li class="empty-message">Empty. Finish something and it rests here.</li>';

  getElement("ghost-count").textContent = hauntedRows.length;
  getElement("exorcised-count").textContent = appData.exorcisedCount;
  getElement("excuse-count").textContent = appData.excuseCount;

  if (selectedTaskId) {
    updatePopup();
  }
}

// ------------------------------------------------------------
// Popup
// ------------------------------------------------------------

function openPopup(taskId) {
  selectedTaskId = taskId;
  getElement("popup-message").textContent = "";
  updatePopup();
  getElement("ghost-popup").hidden = false;
  getElement("done-btn").focus();
}

function closePopup() {
  getElement("ghost-popup").hidden = true;
  selectedTaskId = null;
}

function updatePopup() {
  const task = findTask(selectedTaskId);
  if (!task || task.done) {
    closePopup();
    return;
  }

  const level = getHauntLevel(task);
  getElement("popup-task-name").textContent = task.text;

  if (level > 0) {
    getElement("popup-level").textContent = LEVELS[level].name;
  } else {
    getElement("popup-level").textContent = "Not haunting yet. Haunts in " + formatTimeLeft(task.hauntAt - Date.now());
  }
}

// ------------------------------------------------------------
// Actions
// ------------------------------------------------------------

function exorciseTask(taskId) {
  const task = findTask(taskId);
  if (!task) return;

  task.done = true;
  task.doneAt = Date.now();
  appData.exorcisedCount++;
  saveData();

  const ghost = activeGhosts.get(taskId);
  if (ghost) {
    playExorcismAnimation(taskId, ghost);
  }

  showToast(`"${task.text}" has passed on peacefully.`);
  closePopup();
  refreshEverything();
}

function playExorcismAnimation(taskId, ghost) {
  ghost.isLeaving = true;

  const centerX = ghost.x + ghost.size / 2;
  const centerY = ghost.y + ghost.size / 2;
  const sparkleCount = 14;

  // little sparkles flying out in a circle
  for (let i = 0; i < sparkleCount; i++) {
    const sparkle = document.createElement("div");
    sparkle.className = "sparkle";
    sparkle.style.left = centerX + "px";
    sparkle.style.top = centerY + "px";
    getElement("ghost-layer").appendChild(sparkle);

    const angle = (i / sparkleCount) * Math.PI * 2;
    const distance = 60 + Math.random() * 60;

    const animation = sparkle.animate(
      [
        { transform: "translate(0, 0)", opacity: 1 },
        { transform: `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px) scale(0.2)`, opacity: 0 }
      ],
      { duration: prefersReducedMotion ? 1 : 700, easing: "ease-out" }
    );
    animation.onfinish = () => sparkle.remove();
  }

  // ghost floats up and fades away
  ghost.element.classList.add("disappearing");
  ghost.element.style.transform = `translate(${ghost.x}px, ${ghost.y - 80}px) scale(0.3)`;

  setTimeout(() => {
    ghost.element.remove();
    activeGhosts.delete(taskId);
  }, 520);
}

function makeExcuse() {
  const task = findTask(selectedTaskId);
  if (!task) return;

  const [excuse, ghostReply] = pickRandom(EXCUSES);

  // making an excuse wakes the ghost up right away if it was still alive
  if (Date.now() < task.hauntAt) {
    task.hauntAt = Date.now();
  }

  task.excuses++;
  appData.excuseCount++;
  saveData();

  getElement("popup-message").textContent = `You: "${excuse}"  Ghost: ${ghostReply}`;
  refreshEverything();
}

function snoozeTask() {
  const task = findTask(selectedTaskId);
  if (!task) return;

  // ghost goes away for one interval but comes back +1 level
  task.hauntAt = Date.now() + task.levelUpEvery;
  task.excuses++;
  saveData();

  showToast("Fine. FINE. It will be back, and angrier.");
  closePopup();
  refreshEverything();
}

function addTask(event) {
  event.preventDefault();

  const input = getElement("task-input");
  const text = input.value.trim();
  if (!text) return;

  const seconds = Number(getElement("haunt-time-select").value);

  appData.tasks.push({
    id: generateId(),
    text: text,
    hauntAt: Date.now() + seconds * 1000,
    levelUpEvery: seconds * 1000,
    excuses: 0,
    done: false
  });

  input.value = "";
  saveData();
  refreshEverything();
  showToast("Added. It's alive... for now.");
}

function clearExamples() {
  appData.tasks = appData.tasks.filter(task => !task.isExample);
  saveData();
  refreshEverything();
}

function showToast(message) {
  const toast = getElement("toast");
  toast.textContent = message;
  toast.hidden = false;

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 2600);
}

function refreshEverything() {
  updateGhosts();
  renderTaskLists();
}

// ------------------------------------------------------------
// Event listeners
// ------------------------------------------------------------

getElement("add-task-form").addEventListener("submit", addTask);
getElement("done-btn").addEventListener("click", () => exorciseTask(selectedTaskId));
getElement("excuse-btn").addEventListener("click", makeExcuse);
getElement("snooze-btn").addEventListener("click", snoozeTask);
getElement("close-btn").addEventListener("click", closePopup);
getElement("clear-examples-btn").addEventListener("click", clearExamples);

// buttons inside the lists get re-rendered every second,
// so we listen on the document instead of each button
document.addEventListener("click", event => {
  const doneButton = event.target.closest("[data-done-id]");
  if (doneButton) {
    exorciseTask(doneButton.dataset.doneId);
  }

  const openButton = event.target.closest("[data-open-id]");
  if (openButton) {
    openPopup(openButton.dataset.openId);
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && selectedTaskId) {
    closePopup();
  }
});

window.addEventListener("resize", updateGhosts);

// ------------------------------------------------------------
// Start the app
// ------------------------------------------------------------

const hasSavedData = loadData();
if (!hasSavedData) {
  addExampleTasks();
}

refreshEverything();
setInterval(refreshEverything, 1000); // update timers + levels every second
requestAnimationFrame(animateGhosts);
