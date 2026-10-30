export interface ChatMessage { id: string; role: 'user' | 'assistant'; text: string; at: string; error?: boolean; actions?: ActionResult[] }
export interface ActionResult {
  ok: boolean; name: string; summary: string; data?: unknown; taskId?: string; projectId?: string;
  needsClarification?: boolean; candidates?: { id: string; title: string }[];
}
export interface FunctionCall { type: 'function_call'; id?: string; call_id: string; name: string; arguments: string }
export type ModelItem = Record<string, unknown>;
export interface PendingTurn {
  id: string; userMessageId: string; input: ModelItem[]; step: number;
  calls?: FunctionCall[]; nextCall?: number; results: ActionResult[];
  knownTaskIds: string[]; knownProjectIds: string[]; ambiguousIds: string[];
}
export interface Conversation {
  messages: ChatMessage[]; recentTaskIds: string[]; recentProjectIds: string[]; pending?: PendingTurn;
}
export interface ChatContext {
  today: string; timezone: string; workstream: string; workstreams: string[];
  recentTasks: { id: string; title: string; revision: number }[];
  recentProjects: { id: string; name: string; revision: number }[];
}
export interface ChatRequest { input: ModelItem[]; context: ChatContext }
export interface ChatResponse { output: ModelItem[]; calls: FunctionCall[]; text: string }
