import type * as Party from "partykit/server";

type Team = "A" | "B";
type Phase = "LOBBY" | "WORD_PICK" | "MAPPING" | "PLAY";

type Player = {
  playerId: string;
  name: string;
  icon: string;
  team: Team | null;
  isHost: boolean;
  online: boolean;
  connId?: string;
};

type TeamState = {
  pickedWords: string[];
  picksLocked: boolean;
  mapping: Record<"1"|"2"|"3"|"4", string>;
  mappingLocked: boolean;
  clueLog: Record<string, string[]>; // word -> clues used (single words)
  requiredDigits: number[]; // digits that MUST appear in next code for this team
};

type TurnState = {
  team: Team;
  encryptorId: string;
  decryptorId: string;

  code?: string;               // hidden from decryptor teammate, shown to opponents by your rule
  codePublished: boolean;

  clues?: string[];
  cluesPublished: boolean;

  guess?: string;
  guessSubmitted: boolean;

  verified: boolean;
  lastInternalPoint: boolean | null;

  requiredDigits: number[];    // snapshot for UI
};

type GameState = {
  roomId: string;
  phase: Phase;
  players: Player[];
  hostPlayerId?: string;

  pool: string[];
  pickTeam: Team;

  teams: Record<Team, TeamState>;

  round: number;
  turn: TurnState | null;

  scores: Record<Team, number>;
  log: string[];
};

const WORD_POOL = [
  "Anchor","Mirror","Battery","Desert","Bridge","Clock","Shadow","Glass","Key","Storm","Paper","Cave",
  "Lantern","Orbit","Puzzle","Forest","Canvas","Signal","Temple","Rocket","Hammer","Velvet","Engine","Wallet",
  "Garden","Tunnel","Planet","Needle","Ribbon","Socket","Marble","Ticket","Castle","Pillow","Window","Comet"
];

function freshTeamState(): TeamState {
  return {
    pickedWords: [],
    picksLocked: false,
    mapping: { "1":"", "2":"", "3":"", "4":"" },
    mappingLocked: false,
    clueLog: {},
    requiredDigits: [],
  };
}

function otherTeam(t: Team): Team { return t === "A" ? "B" : "A"; }

function isSingleWord(s: string){
  return !!s && s.trim() === s && !/\s/.test(s);
}

function ensureDigitsCoverage(prevRequired: number[], lastCode: string): number[] {
  // rule: digits skipped in THIS round must appear NEXT time for this team
  const used = new Set(lastCode.split("").map(d=>Number(d)));
  const skipped = [1,2,3,4].filter(d=>!used.has(d));
  // next required = skipped (override)
  return skipped;
}

function scoreMappingGuess(correct: Record<"1"|"2"|"3"|"4", string>, guess: Record<string,string>){
  let hits = 0;
  for(const d of ["1","2","3","4"] as const){
    const g = (guess[d]||"").trim();
    if(g && g.toLowerCase() === (correct[d]||"").toLowerCase()) hits++;
  }
  return hits; // 0..4 points
}

export default class Server implements Party.Server {
  constructor(readonly room: Party.Room) {}

  state!: GameState;

  async onStart() {
    const saved = await this.room.storage.get<GameState>("state");
    if(saved){
      this.state = saved;
      // mark all offline until reconnect
      this.state.players = this.state.players.map(p => ({...p, online:false, connId: undefined}));
      return;
    }

    this.state = {
      roomId: this.room.id,
      phase: "LOBBY",
      players: [],
      pool: [...WORD_POOL],
      pickTeam: "A",
      teams: { A: freshTeamState(), B: freshTeamState() },
      round: 1,
      turn: null,
      scores: { A:0, B:0 },
      log: [],
    };

    await this.persist();
  }

  async onConnect(conn: Party.Connection) {
    conn.send(JSON.stringify({ type:"VIEW", view: this.viewForConn(conn) }));
  }

  async onMessage(message: string, conn: Party.Connection) {
    let msg: any;
    try { msg = JSON.parse(message); } catch { return; }

    try {
      switch(msg.type){
        case "HELLO": return await this.handleHello(conn, msg);
        case "START": return await this.handleStart(conn);
        case "PICK_WORD": return await this.handlePickWord(conn, msg.word);
        case "UNDO_PICK": return await this.handleUndoPick(conn);
        case "LOCK_WORDS": return await this.handleLockWords(conn);
        case "SET_MAPPING": return await this.handleSetMapping(conn, msg.digit, msg.word);
        case "LOCK_MAPPING": return await this.handleLockMapping(conn);

        case "SUBMIT_CODE": return await this.handleSubmitCode(conn, msg.code);
        case "SUBMIT_CLUES": return await this.handleSubmitClues(conn, msg.clues);
        case "SUBMIT_GUESS": return await this.handleSubmitGuess(conn, msg.guess);
        case "VERIFY_TURN": return await this.handleVerify(conn);
        case "SUBMIT_MAPPING_GUESS": return await this.handleMappingGuess(conn, msg.mappingGuess);

        default: return;
      }
    } catch (e: any) {
      conn.send(JSON.stringify({ type:"ERROR", message: e?.message || "Error" }));
    }
  }

  async onClose(conn: Party.Connection) {
    const p = this.playerByConn(conn.id);
    if(p){
      p.online = false;
      p.connId = undefined;
      await this.persist();
      this.broadcastViews();
    }
  }

  // -------- handlers --------
  async handleHello(conn: Party.Connection, { playerId, name, icon }: any){
    if(!playerId || !name) throw new Error("Invalid HELLO");

    let p = this.state.players.find(x => x.playerId === playerId);
    if(!p){
      if(this.state.players.length >= 4) throw new Error("Room full (exactly 4 players).");
      p = {
        playerId,
        name: String(name).slice(0,24),
        icon: String(icon || "bolt"),
        team: null,
        isHost: this.state.players.length === 0,
        online: true,
        connId: conn.id,
      };
      this.state.players.push(p);
      if(p.isHost) this.state.hostPlayerId = p.playerId;
      this.autoAssignTeams();
      this.log(`${p.name} joined`);
    } else {
      p.name = String(name).slice(0,24);
      p.icon = String(icon || p.icon);
      p.online = true;
      p.connId = conn.id;
      this.log(`${p.name} reconnected`);
      this.autoAssignTeams();
    }

    await this.persist();
    this.broadcastViews();
  }

  async handleStart(conn: Party.Connection){
    const me = this.playerByConn(conn.id);
    if(!me?.isHost) throw new Error("Only host can start.");
    if(this.state.players.length !== 4) throw new Error("Need exactly 4 players.");

    // reset for a fresh game start
    this.state.phase = "WORD_PICK";
    this.state.pickTeam = "A";
    this.state.pool = [...WORD_POOL];
    this.state.teams = { A: freshTeamState(), B: freshTeamState() };
    this.state.scores = { A:0, B:0 };
    this.state.round = 1;
    this.state.turn = null;
    this.state.log = ["Game started"];

    await this.persist();
    this.broadcastViews();
  }

  async handlePickWord(conn: Party.Connection, word: string){
    const me = this.playerByConn(conn.id);
    if(this.state.phase !== "WORD_PICK") throw new Error("Not in word pick phase.");
    if(!me?.team) throw new Error("No team.");
    if(me.team !== this.state.pickTeam) throw new Error("Not your team’s pick.");

    const ts = this.state.teams[me.team];
    if(ts.picksLocked) throw new Error("Already locked.");
    if(ts.pickedWords.length >= 4) throw new Error("Already picked 4.");

    word = String(word || "").trim();
    if(!WORD_POOL.includes(word)) throw new Error("Invalid word.");

    // enforce pool: Team B can't pick Team A words
    const alreadyTaken = new Set([...this.state.teams.A.pickedWords, ...this.state.teams.B.pickedWords]);
    if(alreadyTaken.has(word)) throw new Error("Word already taken.");

    ts.pickedWords.push(word);
    this.log(`${me.team} picked: ${word}`);
    await this.persist();
    this.broadcastViews();
  }

  async handleUndoPick(conn: Party.Connection){
    const me = this.playerByConn(conn.id);
    if(this.state.phase !== "WORD_PICK") throw new Error("Not in word pick phase.");
    if(!me?.team) throw new Error("No team.");
    if(me.team !== this.state.pickTeam) throw new Error("Not your team’s pick.");
    const ts = this.state.teams[me.team];
    if(ts.picksLocked) throw new Error("Already locked.");
    ts.pickedWords.pop();
    await this.persist();
    this.broadcastViews();
  }

  async handleLockWords(conn: Party.Connection){
    const me = this.playerByConn(conn.id);
    if(this.state.phase !== "WORD_PICK") throw new Error("Not in word pick phase.");
    if(!me?.team) throw new Error("No team.");
    if(me.team !== this.state.pickTeam) throw new Error("Not your team’s pick.");

    const ts = this.state.teams[me.team];
    if(ts.pickedWords.length !== 4) throw new Error("Pick 4 words first.");
    ts.picksLocked = true;

    // switch to next team or next phase
    if(this.state.pickTeam === "A"){
      this.state.pickTeam = "B";
      this.log("Team A locked words. Team B picking…");
    } else {
      this.log("Team B locked words. Mapping phase…");
      this.state.phase = "MAPPING";
    }

    await this.persist();
    this.broadcastViews();
  }

  async handleSetMapping(conn: Party.Connection, digit: string, word: string){
    const me = this.playerByConn(conn.id);
    if(this.state.phase !== "MAPPING") throw new Error("Not in mapping phase.");
    if(!me?.team) throw new Error("No team.");

    digit = String(digit);
    if(!["1","2","3","4"].includes(digit)) throw new Error("Bad digit.");
    word = String(word || "").trim();
    if(!word) throw new Error("Pick a word.");

    const ts = this.state.teams[me.team];
    if(ts.mappingLocked) throw new Error("Mapping locked.");
    if(!ts.pickedWords.includes(word)) throw new Error("Word not in your picks.");

    // ensure no duplicates
    const used = Object.values(ts.mapping).filter(Boolean);
    if(used.includes(word) && ts.mapping[digit as "1"] !== word) throw new Error("Word already assigned.");

    ts.mapping[digit as "1"] = word;
    await this.persist();
    this.broadcastViews();
  }

  async handleLockMapping(conn: Party.Connection){
    const me = this.playerByConn(conn.id);
    if(this.state.phase !== "MAPPING") throw new Error("Not in mapping phase.");
    if(!me?.team) throw new Error("No team.");

    const ts = this.state.teams[me.team];
    if(ts.mappingLocked) return;
    if(!ts.mapping["1"] || !ts.mapping["2"] || !ts.mapping["3"] || !ts.mapping["4"]) throw new Error("Complete mapping first.");

    ts.mappingLocked = true;
    this.log(`${me.team} locked mapping`);

    if(this.state.teams.A.mappingLocked && this.state.teams.B.mappingLocked){
      this.state.phase = "PLAY";
      this.state.round = 1;
      this.state.turn = this.makeNextTurn("A");
      this.log("Play started. Team A turn.");
    }

    await this.persist();
    this.broadcastViews();
  }

  async handleSubmitCode(conn: Party.Connection, code: string){
    const me = this.playerByConn(conn.id);
    if(this.state.phase !== "PLAY") throw new Error("Not in play.");
    if(!this.state.turn) throw new Error("No turn.");
    if(me?.playerId !== this.state.turn.encryptorId) throw new Error("Only encryptor can submit code.");

    code = String(code||"").trim();
    if(!/^[1-4]{3}$/.test(code)) throw new Error("Code must be 3 digits 1–4.");

    // enforce required digits for this team
    const team = this.state.turn.team;
    const required = this.state.teams[team].requiredDigits;
    if(required.length){
      const used = new Set(code.split("").map(d=>Number(d)));
      for(const d of required){
        if(!used.has(d)) throw new Error(`Code must include required digit: ${d}`);
      }
    }

    this.state.turn.code = code;
    this.state.turn.codePublished = true;
    this.state.turn.requiredDigits = [...required];
    this.log(`${team} code published`);

    await this.persist();
    this.broadcastViews();
  }

  async handleSubmitClues(conn: Party.Connection, clues: string[]){
    const me = this.playerByConn(conn.id);
    if(this.state.phase !== "PLAY") throw new Error("Not in play.");
    if(!this.state.turn) throw new Error("No turn.");
    if(me?.playerId !== this.state.turn.encryptorId) throw new Error("Only encryptor can submit clues.");
    if(!this.state.turn.codePublished || !this.state.turn.code) throw new Error("Publish code first.");

    if(!Array.isArray(clues) || clues.length !== 3) throw new Error("Need 3 clues.");
    const cleaned = clues.map(c=>String(c||"").trim());
    if(cleaned.some(c=>!isSingleWord(c))) throw new Error("Clues must be single words.");

    // clue reuse enforcement PER SECRET WORD
    const team = this.state.turn.team;
    const ts = this.state.teams[team];
    const digits = this.state.turn.code.split("") as ("1"|"2"|"3"|"4")[];

    for(let i=0;i<3;i++){
      const d = digits[i];
      const secretWord = ts.mapping[d];
      if(!secretWord) throw new Error("Team mapping missing.");
      ts.clueLog[secretWord] ||= [];
      if(ts.clueLog[secretWord].some(x => x.toLowerCase() === cleaned[i].toLowerCase())){
        throw new Error(`Clue already used for '${secretWord}'. Choose a new word.`);
      }
    }
    // record
    for(let i=0;i<3;i++){
      const d = digits[i];
      const secretWord = ts.mapping[d];
      ts.clueLog[secretWord].push(cleaned[i]);
    }

    this.state.turn.clues = cleaned;
    this.state.turn.cluesPublished = true;
    this.log(`${team} clues published`);

    await this.persist();
    this.broadcastViews();
  }

  async handleSubmitGuess(conn: Party.Connection, guess: string){
    const me = this.playerByConn(conn.id);
    if(this.state.phase !== "PLAY") throw new Error("Not in play.");
    if(!this.state.turn) throw new Error("No turn.");
    if(me?.playerId !== this.state.turn.decryptorId) throw new Error("Only decryptor can submit guess.");
    if(!this.state.turn.cluesPublished) throw new Error("Wait for clues.");

    guess = String(guess||"").trim();
    if(!/^[1-4]{3}$/.test(guess)) throw new Error("Guess must be 3 digits 1–4.");

    this.state.turn.guess = guess;
    this.state.turn.guessSubmitted = true;
    this.log(`${this.state.turn.team} guess submitted`);

    await this.persist();
    this.broadcastViews();
  }

  async handleVerify(conn: Party.Connection){
    const me = this.playerByConn(conn.id);
    if(this.state.phase !== "PLAY") throw new Error("Not in play.");
    if(!this.state.turn) throw new Error("No turn.");
    if(me?.playerId !== this.state.turn.encryptorId) throw new Error("Only encryptor can verify.");
    if(!this.state.turn.guessSubmitted || !this.state.turn.code) throw new Error("No guess to verify.");
    if(this.state.turn.verified) return;

    const team = this.state.turn.team;
    const correct = this.state.turn.guess === this.state.turn.code;
    this.state.turn.verified = true;
    this.state.turn.lastInternalPoint = correct;
    if(correct) this.state.scores[team] += 1;

    // update required digits for NEXT time this team makes a code
    this.state.teams[team].requiredDigits = ensureDigitsCoverage(this.state.teams[team].requiredDigits, this.state.turn.code);

    this.log(`${team} verify: ${correct ? "correct (+1)" : "wrong (+0)"}`);

    // advance to next team turn
    const nextTeam = otherTeam(team);
    this.state.turn = this.makeNextTurn(nextTeam);

    // bump round when switching back to A
    if(nextTeam === "A") this.state.round += 1;

    await this.persist();
    this.broadcastViews();
  }

  async handleMappingGuess(conn: Party.Connection, mappingGuess: Record<string,string>){
    const me = this.playerByConn(conn.id);
    if(this.state.phase !== "PLAY") throw new Error("Not in play.");
    if(!me?.team) throw new Error("No team.");

    // score against opponent mapping
    const enemy = otherTeam(me.team);
    const correctMap = this.state.teams[enemy].mapping;
    const pts = scoreMappingGuess(correctMap, mappingGuess || {});
    this.state.scores[me.team] += pts;
    this.log(`${me.team} mapping guess: +${pts}`);

    await this.persist();
    this.broadcastViews();
  }

  // -------- view & turn utils --------
  makeNextTurn(team: Team): TurnState {
    const teamPlayers = this.state.players.filter(p=>p.team===team).map(p=>p.playerId);
    if(teamPlayers.length !== 2) throw new Error("Team not ready.");

    // rotate encryptor each time that team plays
    const lastEncryptor = this.state.turn?.team === team ? this.state.turn.encryptorId : null;
    const encryptorId = lastEncryptor ? teamPlayers.find(id=>id!==lastEncryptor)! : teamPlayers[0];
    const decryptorId = teamPlayers.find(id=>id!==encryptorId)!;

    return {
      team,
      encryptorId,
      decryptorId,
      codePublished: false,
      cluesPublished: false,
      guessSubmitted: false,
      verified: false,
      lastInternalPoint: null,
      requiredDigits: [...this.state.teams[team].requiredDigits],
    };
  }

  viewForConn(conn: Party.Connection){
    const p = this.playerByConn(conn.id);
    const meId = p?.playerId;

    const base: any = {
      roomId: this.state.roomId,
      phase: this.state.phase,
      players: this.state.players.map(pl => ({
        playerId: pl.playerId,
        name: pl.name,
        icon: pl.icon,
        team: pl.team,
        isHost: pl.isHost,
        online: pl.online,
      })),
      hostName: this.state.players.find(x=>x.isHost)?.name,
      me: {
        playerId: meId,
        name: p?.name,
        team: p?.team,
        isHost: p?.isHost,
      },
    };

    if(this.state.phase === "LOBBY") return base;

    if(this.state.phase === "WORD_PICK"){
      const meTeam = p?.team as Team;
      const my = this.state.teams[meTeam];
      const enemy = this.state.teams[otherTeam(meTeam)];
      const taken = new Set([...this.state.teams.A.pickedWords, ...this.state.teams.B.pickedWords]);

      // pool visibility: Team B cannot see Team A chosen words (and vice versa is fine)
      // implement: both teams see pool minus already taken words
      const visiblePool = this.state.pool.filter(w => !taken.has(w) || my.pickedWords.includes(w));

      return {
        ...base,
        pick: { team: this.state.pickTeam },
        pool: visiblePool,
        myTeam: { pickedWords: [...my.pickedWords] },
        enemyTeam: { pickedWords: [...enemy.pickedWords] },
      };
    }

    if(this.state.phase === "MAPPING"){
      const meTeam = p?.team as Team;
      const my = this.state.teams[meTeam];
      return {
        ...base,
        myTeam: {
          pickedWords: [...my.pickedWords],
          mapping: {...my.mapping},
          mappingLocked: my.mappingLocked,
        },
      };
    }

    if(this.state.phase === "PLAY"){
      const meTeam = p?.team as Team;
      const my = this.state.teams[meTeam];
      const enemy = this.state.teams[otherTeam(meTeam)];

      const turn = this.state.turn!;
      const isOpponent = turn.team !== meTeam;
      const amEncryptor = turn.encryptorId === meId;
      const amDecryptor = turn.decryptorId === meId;

      // house rule visibility:
      // - opponent team sees code once published
      // - encryptor sees code
      // - decryptor teammate does NOT see code
      let visibleCode: string | null = null;
      if(turn.codePublished){
        if(isOpponent) visibleCode = turn.code!;
        else if(amEncryptor) visibleCode = turn.code!;
        else if(amDecryptor) visibleCode = null;
      }

      return {
        ...base,
        round: this.state.round,
        scores: {...this.state.scores},
        log: [...this.state.log],
        myTeam: {
          pickedWords: [...my.pickedWords],
          mapping: {...my.mapping},
        },
        enemyTeam: {
          pickedWordsCount: enemy.pickedWords.length,
        },
        turn: {
          team: turn.team,
          encryptorId: turn.encryptorId,
          decryptorId: turn.decryptorId,
          requiredDigits: [...this.state.teams[turn.team].requiredDigits],
          codePublished: turn.codePublished,
          visibleCode,
          clues: turn.clues || [],
          cluesPublished: turn.cluesPublished,
          guess: turn.guess || "",
          guessSubmitted: turn.guessSubmitted,
          verified: turn.verified,
          lastInternalPoint: turn.lastInternalPoint,
        }
      };
    }

    return base;
  }

  playerByConn(connId: string){
    return this.state.players.find(p => p.connId === connId);
  }

  autoAssignTeams(){
    // deterministic assignment by join order: first 2 -> A, next 2 -> B
    const players = this.state.players;
    for(let i=0;i<players.length;i++){
      players[i].team = i < 2 ? "A" : "B";
    }
  }

  log(line: string){
    const stamp = new Date().toLocaleTimeString();
    this.state.log.push(`[${stamp}] ${line}`);
    if(this.state.log.length > 200) this.state.log.shift();
  }

  async persist(){
    await this.room.storage.put("state", this.state);
  }

  broadcastViews(){
    for(const c of this.room.getConnections()){
      c.send(JSON.stringify({ type:"VIEW", view: this.viewForConn(c) }));
    }
  }
}
