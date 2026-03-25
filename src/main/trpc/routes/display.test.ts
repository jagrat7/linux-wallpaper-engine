import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks ---------------------------------------------------------------

const { mockDisplayService } = vi.hoisted(() => ({
  mockDisplayService: {
    detectDisplays: vi.fn(),
    getDisplaySession: vi.fn(),
    getMaxRefreshRate: vi.fn(),
  },
}))

vi.mock('../../services/display', () => ({
  displayService: mockDisplayService,
}))

// Import router after mocks
import { displayRouter } from './display'
import { trpc } from '../trpc'

// --- Helpers -------------------------------------------------------------

const caller = trpc.createCallerFactory(displayRouter)({ senderId: undefined })

const makeDisplay = (overrides = {}) => ({
  id: 'eDP-1',
  name: 'eDP-1',
  resolution: '1920x1080',
  width: 1920,
  height: 1080,
  x: 0,
  y: 0,
  refreshRate: 60,
  primary: true,
  connected: true,
  ...overrides,
})

// --- Tests ---------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

describe('displayRouter', () => {
  describe('list', () => {
    it('should return detected displays', async () => {
      const displays = [makeDisplay(), makeDisplay({ id: 'HDMI-1', name: 'HDMI-1', primary: false })]
      mockDisplayService.detectDisplays.mockResolvedValue(displays)

      const result = await caller.list()

      expect(mockDisplayService.detectDisplays).toHaveBeenCalled()
      expect(result).toEqual(displays)
      expect(result).toHaveLength(2)
    })

    it('should return fallback display when no real displays found', async () => {
      const fallback = [makeDisplay({ id: 'default', name: 'Unknown Display' })]
      mockDisplayService.detectDisplays.mockResolvedValue(fallback)

      const result = await caller.list()
      expect(result[0].name).toBe('Unknown Display')
    })

    it('should return empty array if service returns empty', async () => {
      mockDisplayService.detectDisplays.mockResolvedValue([])
      const result = await caller.list()
      expect(result).toEqual([])
    })
  })

  describe('session', () => {
    it('should return x11 session type', async () => {
      mockDisplayService.getDisplaySession.mockResolvedValue('x11')
      const result = await caller.session()
      expect(result).toEqual({ type: 'x11' })
    })

    it('should return wayland session type', async () => {
      mockDisplayService.getDisplaySession.mockResolvedValue('wayland')
      const result = await caller.session()
      expect(result).toEqual({ type: 'wayland' })
    })

    it('should return unknown when session cannot be detected', async () => {
      mockDisplayService.getDisplaySession.mockResolvedValue('unknown')
      const result = await caller.session()
      expect(result).toEqual({ type: 'unknown' })
    })
  })

  describe('maxRefreshRate', () => {
    it('should return max refresh rate across displays', async () => {
      mockDisplayService.getMaxRefreshRate.mockResolvedValue(144)
      const result = await caller.maxRefreshRate()
      expect(result).toEqual({ maxRefreshRate: 144 })
    })

    it('should return 60 as default when only standard displays', async () => {
      mockDisplayService.getMaxRefreshRate.mockResolvedValue(60)
      const result = await caller.maxRefreshRate()
      expect(result).toEqual({ maxRefreshRate: 60 })
    })
  })
})
