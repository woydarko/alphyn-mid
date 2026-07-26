// Migration stub. The EVM ABI is gone; on Midnight, vault interactions are
// Compact circuit calls (createVault / rebalance / follow) made via the deployed
// contract handle + Lace, wired in ALP-12. This placeholder keeps legacy pages
// resolving until each is ported off the inert wagmi contract-hook stubs.
export const AlphynVaultABI = [] as const;
