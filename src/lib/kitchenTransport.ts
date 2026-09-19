import type { KitchenOrder, KitchenStatus } from '../../shared/kitchen'

export interface KitchenTransport {
  list(): Promise<KitchenOrder[]>
  setStatus(id: number, status: KitchenStatus): Promise<KitchenOrder>
  onEvent(cb: (e: { type: 'order:new' | 'order:updated'; order: KitchenOrder }) => void): () => void
}

export const electronKitchenTransport: KitchenTransport = {
  list: () => window.api['kitchen:list'](),
  setStatus: (id, status) => window.api['kitchen:setStatus'](id, status),
  onEvent: cb => window.api.onKitchenEvent(cb),
}
