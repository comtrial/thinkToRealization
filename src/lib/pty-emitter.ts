type Listener = (data: string) => void

class PTYDataEmitter {
  private listeners = new Map<string, Set<Listener>>()

  on(nodeId: string, listener: Listener) {
    if (!this.listeners.has(nodeId)) {
      this.listeners.set(nodeId, new Set())
    }
    this.listeners.get(nodeId)!.add(listener)
  }

  off(nodeId: string, listener: Listener) {
    this.listeners.get(nodeId)?.delete(listener)
  }

  emit(nodeId: string, data: string) {
    this.listeners.get(nodeId)?.forEach((fn) => fn(data))
  }
}

export const ptyDataEmitter = new PTYDataEmitter()
