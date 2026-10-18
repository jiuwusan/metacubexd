import type { WsMsg } from '~/types'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import { useConnectionsStore } from '../connections'

const dbMock = vi.hoisted(() => ({
  addLogs: vi.fn(),
  cleanup: vi.fn(),
  clearAll: vi.fn(),
}))

vi.mock('~/utils/db', () => ({ db: dbMock }))

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
    get length() {
      return Object.keys(store).length
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
  }
})()
vi.stubGlobal('localStorage', localStorageMock)

const mockGlobalStore = { clearChartHistory: vi.fn() }
const mockEndpointStore = reactive({ selectedEndpoint: 'endpoint-a' })
const mockConfigStore = { enableDataUsageTracking: true }

vi.stubGlobal('useGlobalStore', () => mockGlobalStore)
vi.stubGlobal('useEndpointStore', () => mockEndpointStore)
vi.stubGlobal('useConfigStore', () => mockConfigStore)

function makeConn(id: string, upload: number, download: number) {
  return {
    id,
    upload,
    download,
    chains: ['DIRECT'],
    metadata: {
      sourceIP: '10.0.0.1',
      host: 'example.com',
      destinationIP: '93.184.216.34',
      process: 'curl',
      inboundUser: 'user',
      type: 'http',
    },
  }
}

function makeMsg(
  uploadTotal: number,
  downloadTotal: number,
  connections: ReturnType<typeof makeConn>[],
): WsMsg {
  return { uploadTotal, downloadTotal, connections } as unknown as WsMsg
}

describe('stores/connections restart detection vs endpoint switch', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorageMock.clear()
    mockEndpointStore.selectedEndpoint = 'endpoint-a'
  })

  it('does not wipe usage history or chart when switching endpoints', async () => {
    const store = useConnectionsStore()

    // Backend A establishes a high cumulative baseline.
    store.updateFromWsMsg(makeMsg(1000, 2000, [makeConn('c1', 500, 1000)]))

    // Switch to backend B (SPA navigation, no page reload).
    mockEndpointStore.selectedEndpoint = 'endpoint-b'
    await nextTick()

    // Backend B's first message has lower totals (a freshly started kernel).
    store.updateFromWsMsg(makeMsg(10, 20, [makeConn('c2', 5, 10)]))

    expect(dbMock.clearAll).not.toHaveBeenCalled()
    expect(mockGlobalStore.clearChartHistory).not.toHaveBeenCalled()
  })

  it('still detects a real kernel restart on the same endpoint', () => {
    const store = useConnectionsStore()

    store.updateFromWsMsg(makeMsg(1000, 2000, [makeConn('c1', 500, 1000)]))
    // Same endpoint, cumulative totals drop → genuine restart.
    store.updateFromWsMsg(makeMsg(10, 20, [makeConn('c1', 5, 10)]))

    expect(dbMock.clearAll).toHaveBeenCalled()
    expect(mockGlobalStore.clearChartHistory).toHaveBeenCalled()
  })

  it('clears the previous backend connection list without deleting usage history', async () => {
    const store = useConnectionsStore()
    store.updateFromWsMsg(makeMsg(1000, 2000, [makeConn('home', 500, 1000)]))
    expect(store.activeConnections).toHaveLength(1)

    mockEndpointStore.selectedEndpoint = 'endpoint-b'
    await nextTick()

    expect(store.allConnections).toEqual([])
    expect(store.activeConnections).toEqual([])
    expect(store.closedConnections).toEqual([])
    expect(store.latestConnectionMsg).toBeNull()
    expect(dbMock.clearAll).not.toHaveBeenCalled()
  })
})
