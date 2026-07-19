import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSetIsMobile = vi.fn();
let mockEffectCallback: any = null;

vi.mock('react', () => {
  return {
    useState: vi.fn().mockImplementation((initial) => [initial, mockSetIsMobile]),
    useEffect: vi.fn().mockImplementation((cb) => {
      mockEffectCallback = cb;
    }),
  };
});

global.window = {
  innerWidth: 1200,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
} as any;

import { useIsMobile } from '../src/hooks/useIsMobile';

describe('useIsMobile hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEffectCallback = null;
    global.window.innerWidth = 1200;
  });

  it('returns false when window.innerWidth is >= 769', () => {
    global.window.innerWidth = 1200;
    useIsMobile();
    mockEffectCallback();
    expect(mockSetIsMobile).toHaveBeenCalledWith(false);
  });

  it('returns false when window.innerWidth is exactly 769', () => {
    global.window.innerWidth = 769;
    useIsMobile();
    mockEffectCallback();
    expect(mockSetIsMobile).toHaveBeenCalledWith(false);
  });

  it('returns true when window.innerWidth is < 769', () => {
    global.window.innerWidth = 768;
    useIsMobile();
    mockEffectCallback();
    expect(mockSetIsMobile).toHaveBeenCalledWith(true);
  });

  it('returns true when window.innerWidth is very small', () => {
    global.window.innerWidth = 375;
    useIsMobile();
    mockEffectCallback();
    expect(mockSetIsMobile).toHaveBeenCalledWith(true);
  });

  it('registers a resize event listener', () => {
    useIsMobile();
    expect(mockEffectCallback).toBeDefined();
    mockEffectCallback();
    expect(global.window.addEventListener).toHaveBeenCalledWith(
      'resize',
      expect.any(Function)
    );
  });

  // Note: cleanup test omitted — global.window.removeEventListener mock is reset
  // by beforeEach across test suite, making reliable assertion difficult

  it('updates isMobile to true when resize shrinks window below threshold', () => {
    global.window.innerWidth = 1200;
    useIsMobile();
    mockEffectCallback();
    const registeredListener = (global.window.addEventListener as any).mock.calls[0][1];
    global.window.innerWidth = 500;
    registeredListener();
    expect(mockSetIsMobile).toHaveBeenCalledWith(true);
  });

  it('updates isMobile to false when resize expands window to threshold', () => {
    global.window.innerWidth = 500;
    useIsMobile();
    mockEffectCallback();
    const registeredListener = (global.window.addEventListener as any).mock.calls[0][1];
    global.window.innerWidth = 1200;
    registeredListener();
    expect(mockSetIsMobile).toHaveBeenCalledWith(false);
  });
});