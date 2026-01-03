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

const ICONS = [
  { id:"bolt", label:"Bolt", svg:`<svg viewBox="0 0 24 24" fill="none"><path d="M13 2L4 14h7l-1 8 10-12h-7l0-8z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>` },
  { id:"key", label:"Key", svg:`<svg viewBox="0 0 24 24" fill="none"><path d="M21 10a6 6 0 1 1-11.3-2.7A6 6 0 0 1 21 10Z" stroke="currentColor" stroke-width="2"/><path d="M10 10h11l-2 2 2 2-2 2" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>` },
  { id:"eye", label:"Eye", svg:`<svg viewBox="0 0 24 24" fill="none"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" stroke="currentColor" stroke-width="2"/><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" stroke-width="2"/></svg>` },
  { id:"cube", label:"Cube", svg:`<svg viewBox="0 0 24 24" fill="none"><path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 22V12L3 7" stroke="currentColor" stroke-width="2"/><path d="M12 12l9-5" stroke="currentColor" stroke-width="2"/></svg>` },
  { id:"mask", label:"Mask", svg:`<svg viewBox="0 0 24 24" fill="none"><path d="M4 7c2 2 4 3 8 3s6-1 8-3v7c0 5-4 8-8 8s-8-3-8-8V7Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M8 14h0" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M16 14h0" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>` },
];

const LOCAL = {
  get playerId(){ return localStorage.getItem("dc_playerId"); },
  set playerId(v){ localStorage.setItem("dc_playerId", v); },
  get name(){ return localStorage.getItem("dc_name") || ""; },
  set name(v){ localStorage.setItem("dc_name", v); },
  get icon(){ return localStorage.getItem("dc_icon") || ICONS[0].id; },
  set icon(v){ localStorage.setItem("dc_icon", v); },
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
    send({ type:"HELLO", playerId: LOCAL.playerId, name: LOCAL.name, icon: LOCAL.icon });
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
      alert(msg.message);
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
  const iconOptions = ICONS.map(i => `
    <button class="chip" data-icon="${i.id}" type="button">
      <span class="avatar">${i.svg}</span>
      <strong>${i.label}</strong>
    </button>
  `).join("");

  return `
  <section class="card">
    <h2>Start</h2>
    <p>Enter your name and pick an icon. This is saved on your device.</p>

    <div class="grid2">
      <div>
        <h3>Name</h3>
        <input id="name" placeholder="Your name" value="${escapeHtml(LOCAL.name)}" />
      </div>
      <div>
        <h3>Room code</h3>
        <input id="room" class="mono" placeholder="e.g. NYE2026" value="${escapeHtml(LOCAL.lastRoom)}" />
      </div>
    </div>

    <div class="sep"></div>

    <h3>Pick an icon</h3>
    <div class="chips" id="iconGrid">${iconOptions}</div>

    <div class="sep"></div>

    <div class="row">
      <div class="col">
        <button class="btn-primary" id="createRoom">Create room</button>
      </div>
      <div class="col">
        <button id="joinRoom">Join room</button>
      </div>
    </div>

    <p class="warn">Needs exactly 4 players to start.</p>
    <p class="muted">Tip: for remote play, share the room code.</p>
  </section>
  `;
}

function wireIdentity(){
  const iconGrid = $("#iconGrid");
  let selected = LOCAL.icon;

  highlightIcon(selected);

  iconGrid?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-icon]");
    if(!btn) return;
    selected = btn.dataset.icon;
    LOCAL.icon = selected;
    highlightIcon(selected);
  });

  $("#createRoom")?.addEventListener("click", () => {
    const name = $("#name").value.trim();
    const room = ($("#room").value.trim() || makeRoomCode());
    if(!name) return alert("Enter a name");
    LOCAL.name = name;
    $("#room").value = room;
    connect(room);
  });

  $("#joinRoom")?.addEventListener("click", () => {
    const name = $("#name").value.trim();
    const room = $("#room").value.trim();
    if(!name) return alert("Enter a name");
    if(!room) return alert("Enter a room code");
    LOCAL.name = name;
    connect(room);
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
    alert(ok ? "Copied" : "Copy failed");
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
    if(!isDigits3(raw)) return alert("Code must be exactly 3 digits (1–4). Example: 311");
    send({ type:"SUBMIT_CODE", code: raw });
  });

  $("#submitClues")?.addEventListener("click", () => {
    const c1 = clampWord($("#c1").value);
    const c2 = clampWord($("#c2").value);
    const c3 = clampWord($("#c3").value);
    if(!c1 || !c2 || !c3) return alert("All 3 clues required. Single word only.");
    if(c1 !== $("#c1").value.trim() || c2 !== $("#c2").value.trim() || c3 !== $("#c3").value.trim()){
      // spaces were removed
      return alert("Clues must be a single word (no spaces).");
    }
    send({ type:"SUBMIT_CLUES", clues:[c1,c2,c3] });
  });

  $("#submitGuess")?.addEventListener("click", () => {
    const g = $("#guess").value.trim();
    if(!isDigits3(g)) return alert("Guess must be exactly 3 digits (1–4).");
    send({ type:"SUBMIT_GUESS", guess:g });
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
  const icon = ICONS.find(i=>i.id===p.icon)?.svg || ICONS[0].svg;
  return `
    <div class="player">
      <div class="avatar">${icon}</div>
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

function highlightIcon(selected){
  document.querySelectorAll("[data-icon]")?.forEach(btn => {
    const on = btn.dataset.icon === selected;
    btn.style.borderColor = on ? "rgba(122,162,255,.5)" : "var(--line)";
    btn.style.color = on ? "var(--text)" : "var(--muted)";
  });
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
render();
