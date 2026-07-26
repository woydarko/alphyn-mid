// vitest global test setup
// Mock env vars so tests don't need real infra
process.env.UPSTASH_REDIS_REST_URL = 'https://mock.upstash.io';
process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-token';
process.env.SESSION_SECRET = 'test-secret-32chars-minimum-here';
process.env.CHAINGPT_API_KEY = 'test-api-key';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.NEXT_PUBLIC_VAULT_CONTRACT = '0x90ab2482e83be7a1ae550b8c789bc6701267ada0';
process.env.ARBITRUM_SEPOLIA_RPC = 'https://arb-sepolia.example.com';
