import type { AiSession, AiTurn, IAiSessionStorage } from '~ims-app-base/logic/ai-core/AiTypes';
import type { IAppManager } from '~ims-app-base/logic/managers/IAppManager';
import ProjectManager from '~ims-app-base/logic/managers/ProjectManager';

type AiChatData = { sessions: AiSession[]; turns: AiTurn[] };

export default class DesktopAiSessionStorage implements IAiSessionStorage {
  private _appManager: IAppManager;

  constructor(appManager: IAppManager) {
    this._appManager = appManager;
  }

  private _getProjectPath(): string | null {
    return this._appManager.get(ProjectManager).getProjectInfo()?.localPath ?? null;
  }

  private async _load(projectPath: string): Promise<AiChatData> {
    return await window.imshost.project.loadAiChat(projectPath);
  }

  private async _save(projectPath: string, data: AiChatData): Promise<void> {
    await window.imshost.project.saveAiChat(projectPath, data);
  }

  async loadSessions(): Promise<AiSession[]> {
    const projectPath = this._getProjectPath();
    if (!projectPath) return [];
    const data = await this._load(projectPath);
    return data.sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async createSession(session: AiSession): Promise<void> {
    const projectPath = this._getProjectPath();
    if (!projectPath) return;
    const data = await this._load(projectPath);
    data.sessions.push(session);
    await this._save(projectPath, data);
  }

  async updateSession(session: AiSession): Promise<void> {
    const projectPath = this._getProjectPath();
    if (!projectPath) return;
    const data = await this._load(projectPath);
    const idx = data.sessions.findIndex(s => s.id === session.id);
    if (idx >= 0) {
      data.sessions[idx] = session;
      await this._save(projectPath, data);
    }
  }

  async deleteSession(id: string): Promise<void> {
    const projectPath = this._getProjectPath();
    if (!projectPath) return;
    const data = await this._load(projectPath);
    data.sessions = data.sessions.filter(s => s.id !== id);
    await this._save(projectPath, data);
  }

  async deleteMessagesOfSession(_sessionId: string): Promise<void> {
    // In this implementation turns contain all the data, so nothing extra to clean
  }

  async loadTurns(sessionId: string): Promise<AiTurn[]> {
    const projectPath = this._getProjectPath();
    if (!projectPath) return [];
    const data = await this._load(projectPath);
    return data.turns.filter(t => t.sessionId === sessionId);
  }

  async createTurn(turn: AiTurn): Promise<void> {
    const projectPath = this._getProjectPath();
    if (!projectPath) return;
    const data = await this._load(projectPath);
    data.turns.push(turn);
    await this._save(projectPath, data);
  }

  async updateTurn(turn: AiTurn): Promise<void> {
    const projectPath = this._getProjectPath();
    if (!projectPath) return;
    const data = await this._load(projectPath);
    const idx = data.turns.findIndex(t => t.id === turn.id);
    if (idx >= 0) {
      data.turns[idx] = turn;
      await this._save(projectPath, data);
    }
  }

  async deleteTurnsOfSession(sessionId: string): Promise<void> {
    const projectPath = this._getProjectPath();
    if (!projectPath) return;
    const data = await this._load(projectPath);
    data.turns = data.turns.filter(t => t.sessionId !== sessionId);
    await this._save(projectPath, data);
  }
}
