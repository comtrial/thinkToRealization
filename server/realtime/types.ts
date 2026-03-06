/**
 * Realtime event adapter interface
 *
 * Current: WebSocket (local)
 * Future: Supabase Realtime, SSE, Pusher, etc.
 */
export interface RealtimeEvent {
  type: string;
  payload: Record<string, unknown>;
  /** Target specific node (null = broadcast to all) */
  targetNodeId?: string | null;
}

export interface RealtimeAdapter {
  /** Adapter name */
  readonly name: string;

  /** Broadcast event to all subscribers */
  broadcast(event: RealtimeEvent): void;

  /** Send event to subscribers of a specific node */
  broadcastToNode(nodeId: string, event: RealtimeEvent): void;

  /** Initialize adapter */
  start(): Promise<void>;

  /** Shut down adapter */
  stop(): Promise<void>;
}
