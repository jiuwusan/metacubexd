import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useEndpointStore } from '~/stores/endpoint'
import { useConnect } from '../useConnect'

const checkEndpoint = vi.hoisted(() => vi.fn())
vi.mock('../useApi', () => ({ checkEndpointAPI: checkEndpoint }))

const router = { replace: vi.fn() }
vi.stubGlobal('useRouter', () => router)
vi.stubGlobal('useEndpointStore', useEndpointStore)

function deferredCheck() {
  let resolve!: (error: 'auth_error' | 'network_error' | null) => void
  const promise = new Promise<'auth_error' | 'network_error' | null>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('saved endpoint switching', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    const store = useEndpointStore()
    store.setEndpointList([
      {
        id: 'home',
        url: 'https://home.example/mihomo/',
        secret: 'home-secret',
      },
      {
        id: 'office',
        url: 'https://office.example/api/',
        secret: 'office-secret',
      },
      { id: 'travel', url: 'https://travel.example', secret: '' },
    ])
    store.setSelectedEndpoint('home')
    checkEndpoint.mockResolvedValue(null)
  })

  it('keeps the active backend until validation succeeds and preserves the page', async () => {
    const pending = deferredCheck()
    checkEndpoint.mockReturnValueOnce(pending.promise)
    const store = useEndpointStore()
    const connection = useConnect()
    const switching = connection.selectEndpoint('office', {
      preserveRoute: true,
    })

    expect(store.selectedEndpoint).toBe('home')
    expect(connection.isSubmitting.value).toBe(true)
    expect(checkEndpoint).toHaveBeenCalledWith(
      'https://office.example/api/',
      'office-secret',
    )
    pending.resolve(null)

    expect(await switching).toBe(true)
    expect(store.selectedEndpoint).toBe('office')
    expect(router.replace).not.toHaveBeenCalled()
    expect(connection.isSubmitting.value).toBe(false)
  })

  it('retains the old backend and reports an authentication failure', async () => {
    checkEndpoint.mockResolvedValueOnce('auth_error')
    const connection = useConnect()

    expect(
      await connection.selectEndpoint('office', { preserveRoute: true }),
    ).toBe(false)
    expect(useEndpointStore().selectedEndpoint).toBe('home')
    expect(connection.endpointError.value).toBe('auth_error')
    expect(router.replace).not.toHaveBeenCalled()
  })

  it('ignores an older successful check after a newer selection', async () => {
    const older = deferredCheck()
    const newer = deferredCheck()
    checkEndpoint
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise)
    const connection = useConnect()
    const first = connection.selectEndpoint('office', { preserveRoute: true })
    const second = connection.selectEndpoint('travel', { preserveRoute: true })
    older.resolve(null)

    expect(await first).toBe(false)
    expect(useEndpointStore().selectedEndpoint).toBe('home')
    expect(connection.isSubmitting.value).toBe(true)
    newer.resolve(null)
    expect(await second).toBe(true)
    expect(useEndpointStore().selectedEndpoint).toBe('travel')
  })

  it('does not switch after the selector is dismissed', async () => {
    const pending = deferredCheck()
    checkEndpoint.mockReturnValueOnce(pending.promise)
    const connection = useConnect()
    const switching = connection.selectEndpoint('office', {
      preserveRoute: true,
    })
    connection.cancelSelection()
    pending.resolve(null)

    expect(await switching).toBe(false)
    expect(useEndpointStore().selectedEndpoint).toBe('home')
    expect(connection.isSubmitting.value).toBe(false)
  })

  it('does not activate a removed endpoint after its check succeeds', async () => {
    const pending = deferredCheck()
    checkEndpoint.mockReturnValueOnce(pending.promise)
    const connection = useConnect()
    const switching = connection.selectEndpoint('office', {
      preserveRoute: true,
    })
    useEndpointStore().removeEndpoint('office')
    pending.resolve(null)

    expect(await switching).toBe(false)
    expect(useEndpointStore().selectedEndpoint).toBe('home')
  })

  it('clears pending state when a newer selection no longer exists', async () => {
    const pending = deferredCheck()
    checkEndpoint.mockReturnValueOnce(pending.promise)
    const connection = useConnect()
    const switching = connection.selectEndpoint('office', {
      preserveRoute: true,
    })

    expect(
      await connection.selectEndpoint('missing', { preserveRoute: true }),
    ).toBe(false)
    expect(connection.isSubmitting.value).toBe(false)
    pending.resolve(null)
    expect(await switching).toBe(false)
    expect(useEndpointStore().selectedEndpoint).toBe('home')
  })

  it('preserves the existing overview navigation for the setup form', async () => {
    expect(await useConnect().selectEndpoint('office')).toBe(true)
    expect(router.replace).toHaveBeenCalledWith('/overview')
  })
})
