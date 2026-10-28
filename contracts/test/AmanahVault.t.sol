// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// This file previously held all tests inline. The test suite has been split
// into focused files that are compiled and run together:
//
//   AmanahVault.Base.t.sol     — shared setup, MockERC20, VaultHandler, helpers
//   AmanahVault.Existing.t.sol — pre-existing tests updated for the new ABI
//   AmanahVault.Pending.t.sol  — 16 new pending-release-window tests
//
// Forge picks up all three automatically; this file is intentionally empty
// of test functions so there are no duplicates.
