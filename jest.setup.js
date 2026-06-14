import '@testing-library/jest-dom';

// Polyfill TextEncoder/TextDecoder for the jsdom test environment.
// jsdom does not expose these as globals, but @anthropic-ai/sdk >= 0.104
// references TextEncoder at module-load time (lib/middleware.ts), which would
// otherwise throw "TextEncoder is not defined" when importing modules that
// use the SDK (e.g. variantResolver). Node provides them via `util`.
const { TextEncoder, TextDecoder } = require('util');
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder;
}

// Mock @clerk/nextjs before any imports
jest.mock('@clerk/nextjs', () => ({
  useAuth: jest.fn(() => ({
    isSignedIn: false,
    isLoaded: true,
    userId: null,
  })),
  auth: jest.fn(() => ({ userId: null })),
  ClerkProvider: ({ children }) => children,
}));

// Mock @supabase/supabase-js so importing lib modules never spins up a real
// client (no network, no env-key requirements) during unit tests.
jest.mock('@supabase/supabase-js', () => {
  const createClient = jest.fn(() => {
    const chain = {
      select: jest.fn(() => chain),
      insert: jest.fn(() => chain),
      update: jest.fn(() => chain),
      upsert: jest.fn(() => chain),
      delete: jest.fn(() => chain),
      eq: jest.fn(() => chain),
      in: jest.fn(() => chain),
      order: jest.fn(() => chain),
      limit: jest.fn(() => chain),
      range: jest.fn(() => chain),
      single: jest.fn(() => Promise.resolve({ data: null, error: null })),
      maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
      then: undefined,
    };
    return {
      from: jest.fn(() => chain),
      rpc: jest.fn(() => Promise.resolve({ data: null, error: null })),
      auth: { getUser: jest.fn(() => Promise.resolve({ data: { user: null }, error: null })) },
      storage: { from: jest.fn(() => ({ upload: jest.fn(), getPublicUrl: jest.fn() })) },
    };
  });
  return {
    createClient,
    SupabaseClient: class {},
  };
});

// Mock environment variables for Supabase
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

// Mock localStorage for guest scan tests
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Reset mocks between tests
beforeEach(() => {
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  localStorageMock.clear.mockClear();
});
