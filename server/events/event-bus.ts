import { EventEmitter } from "events";

// Typed event map for all server-side events
export type EventMap = {
  "session:started": { sessionId: string; nodeId: string };
  "session:ended": {
    sessionId: string;
    nodeId: string;
    status: string;
  };
  "session:resumed": { sessionId: string; nodeId: string };
  "node:stateChanged": {
    nodeId: string;
    fromStatus: string;
    toStatus: string;
    triggerType: string;
  };
  "file:changed": {
    sessionId: string;
    filePath: string;
    changeType: string;
  };
  "pty:data": { sessionId: string; data: string };
  "pty:exit": { sessionId: string; exitCode: number; signal?: number };
};

export type EventName = keyof EventMap;

class EventBus {
  private emitter = new EventEmitter();

  constructor() {
    // Allow many listeners (multiple WS clients, session manager, capture manager, etc.)
    this.emitter.setMaxListeners(50);
  }

  emit<K extends EventName>(event: K, payload: EventMap[K]): void {
    this.emitter.emit(event, payload);
  }

  on<K extends EventName>(
    event: K,
    listener: (payload: EventMap[K]) => void
  ): void {
    this.emitter.on(event, listener);
  }

  off<K extends EventName>(
    event: K,
    listener: (payload: EventMap[K]) => void
  ): void {
    this.emitter.off(event, listener);
  }

  once<K extends EventName>(
    event: K,
    listener: (payload: EventMap[K]) => void
  ): void {
    this.emitter.once(event, listener);
  }

  removeAllListeners(event?: EventName): void {
    if (event) {
      this.emitter.removeAllListeners(event);
    } else {
      this.emitter.removeAllListeners();
    }
  }
}

// Singleton export
export const eventBus = new EventBus();
