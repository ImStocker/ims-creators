import type { AiSession, AiTurn, IAiSessionStorage } from '~ims-app-base/logic/ai-core/AiTypes';

const AI_SESSIONS_PREFIX = 'ai_sessions_';
const AI_TURNS_PREFIX = 'ai_turns_';

function getStorageKey(projectId: string, suffix: string): string {
  return `${suffix}${projectId}`;
}

function loadJson<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveJson(key: string, data: any[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

export default class DesktopAiSessionStorage implements IAiSessionStorage {
  private _projectId: string;

  constructor(projectId: string) {
    this._projectId = projectId;
  }

  setProjectId(projectId: string) {
    this._projectId = projectId;
  }

  private get _sessionsKey(): string {
    return getStorageKey(this._projectId, AI_SESSIONS_PREFIX);
  }

  private get _turnsKey(): string {
    return getStorageKey(this._projectId, AI_TURNS_PREFIX);
  }

  async loadSessions(): Promise<AiSession[]> {
    return loadJson<AiSession>(this._sessionsKey);
  }

  async createSession(session: AiSession): Promise<void> {
    const sessions = loadJson<AiSession>(this._sessionsKey);
    sessions.push(session);
    saveJson(this._sessionsKey, sessions);
  }

  async updateSession(session: AiSession): Promise<void> {
    const sessions = loadJson<AiSession>(this._sessionsKey);
    const idx = sessions.findIndex(s => s.id === session.id);
    if (idx >= 0) {
      sessions[idx] = session;
      saveJson(this._sessionsKey, sessions);
    }
  }

  async deleteSession(id: string): Promise<void> {
    const sessions = loadJson<AiSession>(this._sessionsKey);
    saveJson(this._sessionsKey, sessions.filter(s => s.id !== id));
  }

  async deleteMessagesOfSession(_sessionId: string): Promise<void> {
    // In this implementation turns contain all the data, so nothing extra to clean
  }

  async loadTurns(sessionId: string): Promise<AiTurn[]> {
    const allTurns = loadJson<AiTurn>(this._turnsKey);
    return allTurns.filter(t => t.sessionId === sessionId);
  }

  async createTurn(turn: AiTurn): Promise<void> {
    const turns = loadJson<AiTurn>(this._turnsKey);
    turns.push(turn);
    saveJson(this._turnsKey, turns);
  }

  async updateTurn(turn: AiTurn): Promise<void> {
    const turns = loadJson<AiTurn>(this._turnsKey);
    const idx = turns.findIndex(t => t.id === turn.id);
    if (idx >= 0) {
      turns[idx] = turn;
      saveJson(this._turnsKey, turns);
    }
  }

  async deleteTurnsOfSession(sessionId: string): Promise<void> {
    const turns = loadJson<AiTurn>(this._turnsKey);
    saveJson(this._turnsKey, turns.filter(t => t.sessionId !== sessionId));
  }
}
