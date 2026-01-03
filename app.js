import PartySocket from "https://esm.sh/partysocket@1.0.2";

const PARTY_URL = "decrypto.piyushdoorwar.partykit.dev"; // <-- replace after deploy

// ---------- tiny helpers ----------
const $ = (sel) => document.querySelector(sel);
const uid = () => crypto.randomUUID();
const clampWord = (s) => (s || "").trim().replace(/\s+/g, ""); // single word only
const isDigits3 = (s) => /^[1-4]{3}$/.test(s);
const uniq = (arr) => Array.from(new Set(arr));
const copyText = async (t) => {
  try { await navigator.clipboard.writeText(t); return true; } catch { return false; }
};

// Toast notification system
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer") || createToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  
  const iconMap = {
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>`,
    error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>`,
    warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 20h20L12 2z"/><path d="M12 9v4M12 17h.01"/></svg>`,
    info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`
  };
  
  toast.innerHTML = `
    <div class="toast-icon">${iconMap[type] || iconMap.info}</div>
    <div class="toast-message">${escapeHtml(message)}</div>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => toast.classList.add("show"), 10);
  
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function createToastContainer() {
  const container = document.createElement("div");
  container.id = "toastContainer";
  container.className = "toast-container";
  document.body.appendChild(container);
  return container;
}

// Modal system
function showModal(title, content) {
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2>${escapeHtml(title)}</h2>
        <button class="modal-close" aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="modal-body">${content}</div>
    </div>
  `;
  
  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add("show"), 10);
  
  const close = () => {
    modal.classList.remove("show");
    setTimeout(() => modal.remove(), 300);
  };
  
  modal.querySelector(".modal-close").addEventListener("click", close);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });
}

function showInstructions() {
  const content = `
    <div class="instructions">
      <h3>🎯 Objective</h3>
      <p>Your team must communicate using coded messages while intercepting the enemy's codes. First team to 2 interceptions wins!</p>
      
      <h3>🎮 Setup</h3>
      <ul>
        <li>Exactly <strong>4 players</strong> required (2 vs 2)</li>
        <li>Each team picks <strong>4 secret words</strong> and creates a mapping (1-4)</li>
        <li>Only your team knows your word mapping</li>
      </ul>
      
      <h3>📝 Each Round</h3>
      <ol>
        <li><strong>Encryptor</strong> creates a 3-digit code using numbers 1-4 (e.g., "3-1-2")</li>
        <li><strong>Encryptor</strong> gives 3 single-word clues matching the code</li>
        <li><strong>Teammates</strong> guess the 3-digit code from the clues</li>
        <li><strong>Opponents</strong> try to intercept by guessing your code</li>
      </ol>
      
      <h3>✅ Scoring</h3>
      <ul>
        <li><strong>Internal Point:</strong> Your team guesses correctly</li>
        <li><strong>Interception:</strong> Opponents guess your code correctly (+1 point for them)</li>
        <li><strong>Win:</strong> First team to get 2 interceptions wins!</li>
      </ul>
      
      <h3>⚠️ Rules</h3>
      <ul>
        <li>Clues must be <strong>single words</strong> (no spaces)</li>
        <li>Codes use digits <strong>1-4 only</strong></li>
        <li>Can't reuse the same clue for the same word</li>
        <li>All 4 digits (1-4) must be used at least once every 2 rounds</li>
      </ul>
      
      <h3>💡 Tips</h3>
      <ul>
        <li>Be creative but not too obscure with clues</li>
        <li>Track enemy clues to learn their words</li>
        <li>Use the notes section to remember patterns</li>
        <li>Balance being understood by teammates vs hiding from opponents</li>
      </ul>
    </div>
  `;
  showModal("How to Play Decrypto", content);
}

function showIconPicker() {
  const iconOptions = ICONS.map(i => `
    <button class="chip ${LOCAL.icon === i.id ? 'selected' : ''}" data-icon="${i.id}" type="button">
      <span class="avatar">${i.svg}</span>
    </button>
  `).join("");
  
  const customAvatarHtml = LOCAL.customAvatar ? `
    <button class="chip ${LOCAL.icon === 'custom' ? 'selected' : ''}" data-icon="custom" type="button">
      <span class="avatar"><img src="${LOCAL.customAvatar}" alt="Custom" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/></span>
    </button>
  ` : '';
  
  const content = `
    <div id="iconGrid">${iconOptions}${customAvatarHtml}</div>
    <div class="sep"></div>
    <label class="btn-upload">
      <input type="file" id="avatarUpload" accept="image/*" style="display:none" />
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:20px;height:20px">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
      </svg>
      <span>Upload Custom Image</span>
    </label>
  `;
  
  showModal("Choose Your Avatar", content);
  
  // Wire up icon selection
  setTimeout(() => {
    document.querySelectorAll("#iconGrid [data-icon]")?.forEach(btn => {
      btn.addEventListener("click", () => {
        const iconId = btn.dataset.icon;
        LOCAL.icon = iconId;
        showToast("Avatar updated!", "success");
        // Close modal and re-render
        document.querySelector(".modal-overlay")?.click();
        render();
      });
    });
    
    // Wire up image upload
    document.getElementById("avatarUpload")?.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (file) {
        handleImageUpload(file);
        document.querySelector(".modal-overlay")?.click();
      }
    });
  }, 100);
}

// Image upload handler
function handleImageUpload(file) {
  if (!file || !file.type.startsWith('image/')) {
    showToast("Please upload a valid image file", "error");
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (e) => {
    LOCAL.customAvatar = e.target.result;
    LOCAL.icon = "custom";
    showToast("Custom avatar uploaded!", "success");
    // Re-render to show the new avatar
    render();
  };
  reader.readAsDataURL(file);
}

const ICONS = [
  { id:"crown", label:"Crown", svg:`<svg viewBox="0 0 24 24" fill="none"><path d="M2 18h20v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2z" fill="currentColor" opacity=".2"/><path d="M2 12l4 3 4-6 4 6 4-3v6H2v-6z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="6" cy="8" r="2" fill="currentColor"/><circle cx="12" cy="4" r="2" fill="currentColor"/><circle cx="18" cy="8" r="2" fill="currentColor"/></svg>` },
  { id:"wizard", label:"Wizard", svg:`<svg viewBox="0 0 24 24" fill="none"><path d="M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" fill="currentColor" opacity=".2"/><path d="M19 14l.5 2 2 .5-2 .5-.5 2-.5-2-2-.5 2-.5.5-2z" fill="currentColor"/></svg>` },
  { id:"shield", label:"Shield", svg:`<svg viewBox="0 0 24 24" fill="none"><path d="M12 2C8 4 4 4 4 4v7c0 5 3 9 8 11 5-2 8-6 8-11V4s-4 0-8-2z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" fill="currentColor" opacity=".2"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>` },
  { id:"dragon", label:"Dragon", svg:`<svg viewBox="0 0 24 24" fill="none"><path d="M6 12c0-3 2-5 4-6 1-1 2-2 4-3 3 2 6 5 6 9 0 3-2 6-5 8-2 1-4 1-6 0-2-2-3-5-3-8z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" fill="currentColor" opacity=".15"/><circle cx="14" cy="10" r="1.5" fill="currentColor"/><path d="M4 10c0-1 1-2 2-2h2M20 14l2-2-2-2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>` },
  { id:"phoenix", label:"Phoenix", svg:`<svg viewBox="0 0 24 24" fill="none"><path d="M12 2l-2 4-3-1 1 3-4 2 4 1-1 3 3-1 2 4 2-4 3 1-1-3 4-1-4-2 1-3-3 1-2-4z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" fill="currentColor" opacity=".2"/><circle cx="12" cy="8" r="2" fill="currentColor"/><path d="M8 18c0-2 1.5-3 4-3s4 1 4 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>` },
  { id:"castle", label:"Castle", svg:`<svg viewBox="0 0 24 24" fill="none"><path d="M3 10V8h2V6h2V4h2v2h2V4h2v2h2V4h2v2h2v2h2v2h-2v10H5V10H3z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" fill="currentColor" opacity=".15"/><rect x="10" y="14" width="4" height="6" stroke="currentColor" stroke-width="2"/></svg>` },
  { id:"compass", label:"Compass", svg:`<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="currentColor" opacity=".1"/><path d="M15 9l-6 3 3 6 6-3-3-6z" fill="currentColor" opacity=".3" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>` },
  { id:"sword", label:"Sword", svg:`<svg viewBox="0 0 24 24" fill="none"><path d="M14.5 6.5l3 3L20 7l1-1-4-4-1 1-2.5 2.5zM9 12l-5 5 2 2 5-5-2-2z" fill="currentColor" opacity=".2"/><path d="M6 18l-2 2M4 14l16-9M11 13l-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>` },
];

const LOCAL = {
  get playerId(){ return localStorage.getItem("dc_playerId"); },
  set playerId(v){ localStorage.setItem("dc_playerId", v); },
  get name(){ return localStorage.getItem("dc_name") || ""; },
  set name(v){ localStorage.setItem("dc_name", v); },
  get icon(){ return localStorage.getItem("dc_icon") || ICONS[0].id; },
  set icon(v){ localStorage.setItem("dc_icon", v); },
  get customAvatar(){ return localStorage.getItem("dc_customAvatar"); },
  set customAvatar(v){ localStorage.setItem("dc_customAvatar", v); },
  get lastRoom(){ return localStorage.getItem("dc_room") || ""; },
  set lastRoom(v){ localStorage.setItem("dc_room", v); },
};

if(!LOCAL.playerId) LOCAL.playerId = uid();

// ---------- app state ----------
let sock = null;
let view = null; // server-sent view
let clientNotes = { hintNotes:"", enemyNotes:"" };

function setNetStatus(online, text){
  const el = $("#netStatus");
  el.textContent = text || (online ? "Online" : "Offline");
  el.style.color = online ? "var(--good)" : "var(--muted)";
  el.style.borderColor = online ? "rgba(61,220,151,.35)" : "var(--line)";
}

function connect(roomId){
  if(sock) sock.close();
  LOCAL.lastRoom = roomId;

  sock = new PartySocket({
    host: PARTY_URL,
    room: roomId,
    party: "main",
  });

  sock.addEventListener("open", () => {
    setNetStatus(true, "Connected");
    const payload = { 
      type:"HELLO", 
      playerId: LOCAL.playerId, 
      name: LOCAL.name, 
      icon: LOCAL.icon 
    };
    if (LOCAL.icon === "custom" && LOCAL.customAvatar) {
      payload.customAvatar = LOCAL.customAvatar;
    }
    send(payload);
  });

  sock.addEventListener("close", () => {
    setNetStatus(false, "Disconnected");
  });

  sock.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if(msg.type === "VIEW"){
      view = msg.view;
      render();
    }
    if(msg.type === "ERROR"){
      showToast(msg.message, "error");
    }
  });
}

function send(payload){
  if(!sock || sock.readyState !== 1) return;
  sock.send(JSON.stringify(payload));
}

// ---------- UI rendering ----------
function render(){
  const root = $("#app");
  if(!view){
    root.innerHTML = renderIdentity();
    wireIdentity();
    return;
  }

  if(view.phase === "LOBBY"){
    root.innerHTML = renderLobby(view);
    wireLobby(view);
    return;
  }

  if(view.phase === "WORD_PICK"){
    root.innerHTML = renderWordPick(view);
    wireWordPick(view);
    return;
  }

  if(view.phase === "MAPPING"){
    root.innerHTML = renderMapping(view);
    wireMapping(view);
    return;
  }

  if(view.phase === "PLAY"){
    root.innerHTML = renderPlay(view);
    wirePlay(view);
    return;
  }

  root.innerHTML = `<div class="card"><h2>Unknown state</h2></div>`;
}

// ---------- screens ----------
function renderIdentity(){
  const currentIcon = LOCAL.icon === "custom" && LOCAL.customAvatar 
    ? `<img src="${LOCAL.customAvatar}" alt="Custom" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>` 
    : (ICONS.find(i => i.id === LOCAL.icon)?.svg || ICONS[0].svg);

  return `
  <section class="card">
    <h2>Start Game</h2>
    <p>Enter your name and choose your avatar to begin.</p>

    <div class="grid2">
      <div>
        <h3>Your Name</h3>
        <input id="name" placeholder="Enter your name" value="${escapeHtml(LOCAL.name)}" />
      </div>
      <div>
        <h3>Room Code</h3>
        <input id="room" class="mono" placeholder="e.g. ABC123" value="${escapeHtml(LOCAL.lastRoom)}" />
      </div>
    </div>

    <div class="sep"></div>

    <h3>Your Avatar</h3>
    <button class="btn-choose-icon" id="chooseIcon" type="button">
      <div class="current-icon">${currentIcon}</div>
      <span>Choose Avatar</span>
    </button>

    <div class="sep"></div>

    <div class="row">
      <div class="col">
        <button class="btn-primary" id="createRoom">Create Room</button>
      </div>
      <div class="col">
        <button id="joinRoom">Join Room</button>
      </div>
    </div>

    <p class="warn" style="text-align:center; margin-top:16px;">⚠️ Requires exactly 4 players to start</p>
  </section>
  `;
}

function wireIdentity(){
  // Open icon picker modal
  $("#chooseIcon")?.addEventListener("click", () => {
    showIconPicker();
  });

  $("#createRoom")?.addEventListener("click", () => {
    const name = $("#name").value.trim();
    const room = ($("#room").value.trim() || makeRoomCode());
    if(!name) return showToast("Please enter your name", "warning");
    LOCAL.name = name;
    $("#room").value = room;
    connect(room);
    showToast("Creating room...", "info");
  });

  $("#joinRoom")?.addEventListener("click", () => {
    const name = $("#name").value.trim();
    const room = $("#room").value.trim();
    if(!name) return showToast("Please enter your name", "warning");
    if(!room) return showToast("Please enter a room code", "warning");
    LOCAL.name = name;
    connect(room);
    showToast("Joining room...", "info");
  });
}

function renderLobby(v){
  const room = v.roomId;
  const players = v.players.map(p => playerCard(p)).join("");
  const canStart = v.players.length === 4;

  return `
  <section class="card">
    <div class="spread">
      <div>
        <h2>Room</h2>
        <div class="chip mono"><strong>${escapeHtml(room)}</strong></div>
        <p>Share this code. When 4 players join, the host can start.</p>
      </div>
      <div class="hstack">
        <button id="copyRoom">Copy code</button>
        <button class="btn-bad" id="leave">Leave</button>
      </div>
    </div>

    <div class="sep"></div>

    <h3>Players (${v.players.length}/4)</h3>
    <div class="grid2">${players}</div>

    <div class="sep"></div>

    <div class="hstack">
      <div class="chip">Host: <strong>${escapeHtml(v.hostName || "—")}</strong></div>
      <div class="chip">Your team: <strong>${escapeHtml(v.me.team || "Unassigned")}</strong></div>
    </div>

    <div class="sep"></div>

    <button class="btn-good" id="start" ${canStart && v.me.isHost ? "" : "disabled"}>
      Start game
    </button>

    ${!canStart ? `<p class="warn">Need exactly 4 players.</p>` : ``}
    ${canStart && !v.me.isHost ? `<p class="muted">Waiting for host to start…</p>` : ``}
  </section>
  `;
}

function wireLobby(v){
  $("#copyRoom")?.addEventListener("click", async () => {
    const ok = await copyText(v.roomId);
    showToast(ok ? "Room code copied to clipboard!" : "Failed to copy", ok ? "success" : "error");
  });
  $("#leave")?.addEventListener("click", () => { location.reload(); });
  $("#start")?.addEventListener("click", () => {
    send({ type:"START" });
  });
}

function renderWordPick(v){
  const meTeam = v.me.team;
  const isMyPickTeam = v.pick.team === meTeam;
  const myTeamPicked = v.myTeam.pickedWords;
  const enemyPicked = v.enemyTeam.pickedWords;

  const pool = v.pool.map(w => {
    const disabled = !isMyPickTeam || myTeamPicked.includes(w) || myTeamPicked.length >= 4;
    return `<button class="chip" data-word="${escapeHtml(w)}" ${disabled ? "disabled":""}><strong>${escapeHtml(w)}</strong></button>`;
  }).join("");

  return `
  <section class="card">
    <h2>Word selection</h2>
    <p>
      ${isMyPickTeam ? `Your team is picking now.` : `Other team is picking now.`}
      Each team picks <strong>4</strong> single-word nouns from the pool.
    </p>

    <div class="row">
      <div class="col">
        <h3>Your team (${escapeHtml(meTeam)})</h3>
        <div class="chips">
          ${myTeamPicked.map(w=>`<span class="chip"><strong>${escapeHtml(w)}</strong></span>`).join("") || `<span class="chip">None</span>`}
        </div>
      </div>
      <div class="col">
        <h3>Other team</h3>
        <div class="chips">
          ${enemyPicked.map(w=>`<span class="chip"><strong>${escapeHtml(w)}</strong></span>`).join("") || `<span class="chip">None</span>`}
        </div>
      </div>
    </div>

    <div class="sep"></div>

    <h3>Pool</h3>
    <div class="chips" id="pool">${pool}</div>

    <div class="sep"></div>

    <div class="hstack">
      <button id="undo" ${isMyPickTeam && myTeamPicked.length ? "" : "disabled"}>Undo last</button>
      <button class="btn-good" id="lock" ${isMyPickTeam && myTeamPicked.length===4 ? "" : "disabled"}>Lock my team’s 4 words</button>
    </div>

    <p class="muted">Team B never sees Team A’s chosen words in their pool.</p>
  </section>
  `;
}

function wireWordPick(v){
  $("#pool")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-word]");
    if(!btn || btn.disabled) return;
    send({ type:"PICK_WORD", word: btn.dataset.word });
  });
  $("#undo")?.addEventListener("click", () => send({ type:"UNDO_PICK" }));
  $("#lock")?.addEventListener("click", () => send({ type:"LOCK_WORDS" }));
}

function renderMapping(v){
  const words = v.myTeam.pickedWords;
  const locked = v.myTeam.mappingLocked;
  const mapping = v.myTeam.mapping; // {1:"",2:""...} words
  const options = (n) => {
    const used = Object.values(mapping).filter(Boolean);
    return words.map(w => {
      const selected = mapping[String(n)] === w ? "selected" : "";
      const disabled = used.includes(w) && mapping[String(n)] !== w ? "disabled" : "";
      return `<option value="${escapeHtml(w)}" ${selected} ${disabled}>${escapeHtml(w)}</option>`;
    }).join("");
  };

  return `
  <section class="card">
    <h2>Secret mapping</h2>
    <p>Assign your team’s 4 words to numbers 1–4. Both teammates see this. Opponents never do.</p>

    <div class="grid2">
      ${[1,2,3,4].map(n => `
        <div>
          <h3>${n}</h3>
          <select data-map="${n}" ${locked ? "disabled":""}>
            <option value="">Select word…</option>
            ${options(n)}
          </select>
        </div>
      `).join("")}
    </div>

    <div class="sep"></div>
    <button class="btn-good" id="lockMap" ${!locked && allMapped(mapping) ? "" : "disabled"}>Lock mapping</button>
    ${locked ? `<p class="ok">Locked. Waiting for the game to start…</p>` : `<p class="muted">Once locked, you cannot change it.</p>`}
  </section>
  `;
}

function wireMapping(v){
  document.querySelectorAll("[data-map]")?.forEach(sel => {
    sel.addEventListener("change", () => {
      send({ type:"SET_MAPPING", digit: sel.dataset.map, word: sel.value });
    });
  });
  $("#lockMap")?.addEventListener("click", () => send({ type:"LOCK_MAPPING" }));
}

function renderPlay(v){
  const me = v.me;
  const t = v.turn; // turn view
  const myTeam = v.myTeam;
  const enemyTeam = v.enemyTeam;

  const isMyTeamTurn = t.team === me.team;
  const amEncryptor = t.encryptorId === me.playerId;
  const amDecryptor = t.decryptorId === me.playerId;

  const needDigits = t.requiredDigits || [];
  const needText = needDigits.length ? `Must include: ${needDigits.join(", ")}` : `No required digits.`;

  const codeBlock = (() => {
    if(amEncryptor){
      return `
        <h3>🔢 Create code (3 digits)</h3>
        <p class="muted">${needText}</p>
        <input id="code" class="mono" placeholder="e.g. 311" value="${escapeHtml(t.myCodeDraft || "")}" maxlength="3" />
        <button class="btn-primary" id="submitCode">Publish code (opponents will see it)</button>
      `;
    }
    if(amDecryptor){
      return `
        <h3>🔒 Code</h3>
        <p class="muted">You are the decryptor. You must NOT see the code.</p>
        <div class="chip mono">Hidden</div>
      `;
    }
    // spectators (opponent team) can see code once published
    return `
      <h3>👀 Opponent code</h3>
      <div class="chip mono"><strong>${escapeHtml(t.visibleCode || "—")}</strong></div>
      <p class="muted">You can see the opponent’s code (house rule).</p>
    `;
  })();

  const clueBlock = (() => {
    if(!t.codePublished){
      return `<p class="muted">Waiting for encryptor to publish a code…</p>`;
    }
    if(amEncryptor){
      return `
        <h3>🗝️ Give clues (single word each)</h3>
        <div class="grid2">
          <input id="c1" placeholder="clue 1" value="" />
          <input id="c2" placeholder="clue 2" value="" />
          <input id="c3" placeholder="clue 3" value="" />
        </div>
        <button class="btn-primary" id="submitClues">Publish clues</button>
        <p class="muted">No clue reuse for the same secret word. Server enforces.</p>
      `;
    }

    return `
      <h3>📣 Clues (spoken aloud)</h3>
      <div class="chips">
        ${(t.clues || []).length
          ? t.clues.map(c=>`<span class="chip mono"><strong>${escapeHtml(c)}</strong></span>`).join("")
          : `<span class="chip">Waiting…</span>`
        }
      </div>
    `;
  })();

  const guessBlock = (() => {
    if(!t.cluesPublished) return `<p class="muted">Waiting for clues…</p>`;
    if(amDecryptor){
      return `
        <h3>🧩 Enter your guess (3 digits)</h3>
        <input id="guess" class="mono" placeholder="e.g. 124" maxlength="3" />
        <button class="btn-primary" id="submitGuess">Submit guess</button>
      `;
    }
    return `
      <h3>🧾 Guess</h3>
      <div class="chip mono"><strong>${escapeHtml(t.guess || "—")}</strong></div>
      <p class="muted">Decryptor submits. Then encryptor verifies.</p>
    `;
  })();

  const verifyBlock = (() => {
    if(!t.guessSubmitted) return ``;
    if(amEncryptor && !t.verified){
      return `<button class="btn-good" id="verify">Verify & End Turn</button>`;
    }
    if(t.verified){
      return `<p class="${t.lastInternalPoint ? "ok":"warn"}">
        ${t.lastInternalPoint ? "✅ Correct (+1)" : "❌ Incorrect (+0)"} — Turn ended.
      </p>`;
    }
    return ``;
  })();

  const mappingGuessBlock = `
    <div class="sep"></div>
    <h3>🎯 Guess opponent mapping (points)</h3>
    <p class="muted">Submit anytime after a turn ends. You’ll get +4..+0 based on matches.</p>
    <div class="grid2">
      ${[1,2,3,4].map(n=>`
        <div>
          <h3>${n}</h3>
          <input data-mguess="${n}" placeholder="word for ${n}" />
        </div>
      `).join("")}
    </div>
    <button class="btn-warn" id="submitMapGuess">Submit mapping guess</button>
  `;

  const scoreboard = `
    <div class="row">
      <div class="col">
        <div class="turn">
          <div class="big">Team A</div>
          <div class="small">Score: <span class="mono">${v.scores.A}</span></div>
        </div>
      </div>
      <div class="col">
        <div class="turn">
          <div class="big">Team B</div>
          <div class="small">Score: <span class="mono">${v.scores.B}</span></div>
        </div>
      </div>
    </div>
  `;

  const who = (pid) => v.players.find(p=>p.playerId===pid)?.name || "—";

  return `
  <section class="card">
    <div class="spread">
      <div>
        <h2>Game</h2>
        <div class="chips">
          <span class="chip">You: <strong>${escapeHtml(me.name)}</strong></span>
          <span class="chip">Team: <strong>${escapeHtml(me.team)}</strong></span>
          <span class="chip">Room: <strong class="mono">${escapeHtml(v.roomId)}</strong></span>
        </div>
      </div>
      <div class="chips">
        <span class="chip">Round: <strong class="mono">${v.round}</strong></span>
        <span class="chip">Turn: <strong>${escapeHtml(t.team)}</strong></span>
        <span class="chip">Encryptor: <strong>${escapeHtml(who(t.encryptorId))}</strong></span>
        <span class="chip">Decryptor: <strong>${escapeHtml(who(t.decryptorId))}</strong></span>
      </div>
    </div>

    <div class="sep"></div>

    ${scoreboard}

    <div class="sep"></div>

    <div class="row">
      <div class="col">
        <h3>🟦 Your team words (private)</h3>
        <div class="chips">
          ${myTeam.pickedWords.map(w=>`<span class="chip"><strong>${escapeHtml(w)}</strong></span>`).join("")}
        </div>
        <div class="sep"></div>
        <div class="kv">
          <div class="k">1</div><div class="v mono">${escapeHtml(myTeam.mapping["1"]||"—")}</div>
          <div class="k">2</div><div class="v mono">${escapeHtml(myTeam.mapping["2"]||"—")}</div>
          <div class="k">3</div><div class="v mono">${escapeHtml(myTeam.mapping["3"]||"—")}</div>
          <div class="k">4</div><div class="v mono">${escapeHtml(myTeam.mapping["4"]||"—")}</div>
        </div>
      </div>

      <div class="col">
        <h3>🟥 Opponent words</h3>
        <p class="muted">Hidden. You can only infer from clues.</p>
        <div class="chips">
          <span class="chip">Picked: <strong>${enemyTeam.pickedWordsCount}/4</strong></span>
        </div>
        <div class="sep"></div>

        <h3>📝 Your private notes (not synced)</h3>
        <textarea id="notesHints" placeholder="Write the clues you heard + your hypotheses…">${escapeHtml(clientNotes.hintNotes)}</textarea>
      </div>
    </div>

    <div class="sep"></div>

    <div class="row">
      <div class="col">
        <div class="card">
          <h2>Turn actions</h2>
          ${codeBlock}
          <div class="sep"></div>
          ${clueBlock}
          <div class="sep"></div>
          ${guessBlock}
          <div class="sep"></div>
          ${verifyBlock}
          ${mappingGuessBlock}
        </div>
      </div>

      <div class="col">
        <div class="card">
          <h2>🧾 Turn log</h2>
          <p class="muted">This is synced. Notes are not.</p>
          <div class="chips">
            ${(v.log || []).slice(-10).reverse().map(line =>
              `<span class="chip mono">${escapeHtml(line)}</span>`
            ).join("") || `<span class="chip">No events yet</span>`}
          </div>

          <div class="sep"></div>

          <h3>📝 Extra notes (not synced)</h3>
          <textarea id="notesEnemy" placeholder="Enemy mapping guesses, patterns…">${escapeHtml(clientNotes.enemyNotes)}</textarea>
        </div>
      </div>
    </div>

  </section>
  `;
}

function wirePlay(v){
  $("#notesHints")?.addEventListener("input", (e)=> { clientNotes.hintNotes = e.target.value; });
  $("#notesEnemy")?.addEventListener("input", (e)=> { clientNotes.enemyNotes = e.target.value; });

  $("#submitCode")?.addEventListener("click", () => {
    const raw = $("#code").value.trim();
    if(!isDigits3(raw)) return showToast("Code must be exactly 3 digits (1-4). Example: 311", "warning");
    send({ type:"SUBMIT_CODE", code: raw });
    showToast("Code submitted!", "success");
  });

  $("#submitClues")?.addEventListener("click", () => {
    const c1 = clampWord($("#c1").value);
    const c2 = clampWord($("#c2").value);
    const c3 = clampWord($("#c3").value);
    if(!c1 || !c2 || !c3) return showToast("All 3 clues required. Single word only.", "warning");
    if(c1 !== $("#c1").value.trim() || c2 !== $("#c2").value.trim() || c3 !== $("#c3").value.trim()){
      // spaces were removed
      return showToast("Clues must be a single word (no spaces).", "warning");
    }
    send({ type:"SUBMIT_CLUES", clues:[c1,c2,c3] });
    showToast("Clues submitted!", "success");
  });

  $("#submitGuess")?.addEventListener("click", () => {
    const g = $("#guess").value.trim();
    if(!isDigits3(g)) return showToast("Guess must be exactly 3 digits (1-4).", "warning");
    send({ type:"SUBMIT_GUESS", guess:g });
    showToast("Guess submitted!", "success");
  });

  $("#verify")?.addEventListener("click", () => send({ type:"VERIFY_TURN" }));

  $("#submitMapGuess")?.addEventListener("click", () => {
    const mappingGuess = {};
    document.querySelectorAll("[data-mguess]")?.forEach(inp => {
      const d = inp.dataset.mguess;
      mappingGuess[d] = clampWord(inp.value);
    });
    send({ type:"SUBMIT_MAPPING_GUESS", mappingGuess });
  });
}

// ---------- small UI helpers ----------
function playerCard(p){
  let avatarContent;
  if (p.icon === "custom" && p.customAvatar) {
    avatarContent = `<img src="${p.customAvatar}" alt="${escapeHtml(p.name)}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;"/>`;
  } else {
    const iconData = ICONS.find(i=>i.id===p.icon);
    avatarContent = iconData?.svg || ICONS[0].svg;
  }
  
  return `
    <div class="player">
      <div class="avatar">${avatarContent}</div>
      <div>
        <div class="name">${escapeHtml(p.name)}</div>
        <div class="meta">
          <span class="badge">${escapeHtml(p.team || "—")}</span>
          ${p.isHost ? `<span class="badge">Host</span>` : ``}
          ${p.online ? `<span class="badge ok">Online</span>` : `<span class="badge">Offline</span>`}
        </div>
      </div>
    </div>
  `;
}

function makeRoomCode(){
  const a = Math.random().toString(36).slice(2,5).toUpperCase();
  const b = Math.random().toString(36).slice(2,5).toUpperCase();
  return `${a}${b}`;
}

function allMapped(mapping){
  return ["1","2","3","4"].every(k => mapping[k]);
}

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

// boot
document.getElementById("helpBtn")?.addEventListener("click", showInstructions);
render();
