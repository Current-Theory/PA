export interface WorkspaceSnapshot {
  version?: number;
  tasks: import('../lib/model').Task[];
  workstreams: string[];
  projects?: import('../lib/model').Project[];
  conversation?: import('../assistant/contracts').Conversation;
  receipts?: Record<string, { fingerprint: string; result: unknown }>;
  events?: import('../lib/model').WorkspaceEvent[];
}
export interface WorkspaceStorage {
  read(): Promise<WorkspaceSnapshot | undefined>;
  write(snapshot: WorkspaceSnapshot): Promise<void>;
}
// Only the explicitly labelled demo workspace uses this device-local store.
// Live Microsoft tasks must not be routed into it.
export class DemoStorage implements WorkspaceStorage {
  private async open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('earnlearn-demo-v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('workspace');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Device storage is unavailable. Enable site storage and retry.'));
    });
  }
  async read(): Promise<WorkspaceSnapshot | undefined> {
    const db = await this.open();
    try {
      return await new Promise((resolve, reject) => {
        const request = db.transaction('workspace').objectStore('workspace').get('demo');
        request.onsuccess = () => resolve(request.result as WorkspaceSnapshot | undefined);
        request.onerror = () => reject(new Error('Could not read your demo workspace.'));
      });
    } finally { db.close(); }
  }
  async write(snapshot: WorkspaceSnapshot): Promise<void> {
    const db = await this.open();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('workspace', 'readwrite');
        tx.objectStore('workspace').put(snapshot, 'demo');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(new Error('Could not save changes. Device storage may be full.'));
        tx.onabort = () => reject(new Error('Saving was interrupted. Please retry.'));
      });
    } finally { db.close(); }
  }
}
