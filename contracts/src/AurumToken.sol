// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/// @title AurumToken
/// @notice ERC-20 token representing fractional ownership of vault-held gold.
///         Minting and burning are restricted to authorized backend systems.
///         Business logic (KYC, compliance, reserve accounting) is entirely off-chain.
///         The contract only enforces: who can mint/burn, and the ability to pause.
contract AurumToken is
    Initializable,
    ERC20Upgradeable,
    ERC20BurnableUpgradeable,
    ERC20PausableUpgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable
{
    // ─── Roles ───────────────────────────────────────────────────────────────

    bytes32 public constant MINTER_ROLE   = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE   = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // ─── Events ──────────────────────────────────────────────────────────────

    event TokensMinted(address indexed to, uint256 amount, bytes32 indexed orderId);
    event TokensBurned(address indexed from, uint256 amount, bytes32 indexed orderId);

    // ─── Initializer (replaces constructor for upgradeable contracts) ─────────

    /// @param defaultAdmin   Address that receives DEFAULT_ADMIN_ROLE (multisig recommended).
    /// @param minter         Backend hot-wallet address that holds MINTER_ROLE.
    /// @param pauser         Address authorized to pause (ops team).
    function initialize(
        address defaultAdmin,
        address minter,
        address pauser
    ) external initializer {
        __ERC20_init("Aurum Gold Token", "AURUM");
        __ERC20Burnable_init();
        __ERC20Pausable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(MINTER_ROLE, minter);
        _grantRole(PAUSER_ROLE, pauser);
        _grantRole(UPGRADER_ROLE, defaultAdmin);
    }

    // ─── Minting ─────────────────────────────────────────────────────────────

    /// @notice Mint tokens to a wallet after off-chain compliance and reserve allocation.
    /// @param to       Recipient wallet address.
    /// @param amount   Token amount in 18-decimal units.
    /// @param orderId  Internal order ID for on-chain traceability.
    function mint(
        address to,
        uint256 amount,
        bytes32 orderId
    ) external onlyRole(MINTER_ROLE) whenNotPaused {
        _mint(to, amount);
        emit TokensMinted(to, amount, orderId);
    }

    // ─── Burning (user-initiated redemption) ─────────────────────────────────

    /// @notice Burn caller's tokens to initiate a gold redemption.
    ///         Off-chain: compliance check → vault release instruction → settlement.
    /// @param amount   Token amount to burn.
    /// @param orderId  Internal burn/redemption order ID.
    function burnForRedemption(
        uint256 amount,
        bytes32 orderId
    ) external whenNotPaused {
        _burn(msg.sender, amount);
        emit TokensBurned(msg.sender, amount, orderId);
    }

    // ─── Pause ───────────────────────────────────────────────────────────────

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ─── UUPS upgrade authorization ──────────────────────────────────────────

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyRole(UPGRADER_ROLE)
    {}

    // ─── Required overrides ───────────────────────────────────────────────────

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20Upgradeable, ERC20PausableUpgradeable)
    {
        super._update(from, to, value);
    }

    // ─── Token metadata ───────────────────────────────────────────────────────

    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
