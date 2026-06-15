// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/AurumToken.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract AurumTokenTest is Test {
    AurumToken public token;

    address admin   = makeAddr("admin");
    address minter  = makeAddr("minter");
    address pauser  = makeAddr("pauser");
    address user    = makeAddr("user");
    address other   = makeAddr("other");

    bytes32 constant ORDER_ID = keccak256("order-001");

    function setUp() public {
        AurumToken impl = new AurumToken();
        bytes memory initData = abi.encodeCall(
            AurumToken.initialize,
            (admin, minter, pauser)
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        token = AurumToken(address(proxy));
    }

    // ── Minting ──────────────────────────────────────────────────────────────

    function test_MintByMinter() public {
        vm.prank(minter);
        token.mint(user, 1e18, ORDER_ID);
        assertEq(token.balanceOf(user), 1e18);
    }

    function test_MintEmitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit AurumToken.TokensMinted(user, 1e18, ORDER_ID);
        vm.prank(minter);
        token.mint(user, 1e18, ORDER_ID);
    }

    function test_RevertMintByNonMinter() public {
        vm.prank(other);
        vm.expectRevert();
        token.mint(user, 1e18, ORDER_ID);
    }

    // ── Burning ───────────────────────────────────────────────────────────────

    function test_BurnForRedemption() public {
        vm.prank(minter);
        token.mint(user, 2e18, ORDER_ID);

        bytes32 burnOrder = keccak256("burn-001");
        vm.prank(user);
        token.burnForRedemption(1e18, burnOrder);

        assertEq(token.balanceOf(user), 1e18);
    }

    function test_RevertBurnMoreThanBalance() public {
        vm.prank(minter);
        token.mint(user, 1e18, ORDER_ID);

        vm.prank(user);
        vm.expectRevert();
        token.burnForRedemption(2e18, ORDER_ID);
    }

    // ── Pause ─────────────────────────────────────────────────────────────────

    function test_PauseBlocksMint() public {
        vm.prank(pauser);
        token.pause();

        vm.prank(minter);
        vm.expectRevert();
        token.mint(user, 1e18, ORDER_ID);
    }

    function test_UnpauseRestoresMint() public {
        vm.prank(pauser);
        token.pause();

        vm.prank(pauser);
        token.unpause();

        vm.prank(minter);
        token.mint(user, 1e18, ORDER_ID);
        assertEq(token.balanceOf(user), 1e18);
    }

    function test_RevertPauseByNonPauser() public {
        vm.prank(other);
        vm.expectRevert();
        token.pause();
    }

    // ── Decimals & metadata ───────────────────────────────────────────────────

    function test_Decimals() public view {
        assertEq(token.decimals(), 18);
    }

    function test_Name() public view {
        assertEq(token.name(), "Aurum Gold Token");
    }

    function test_Symbol() public view {
        assertEq(token.symbol(), "AURUM");
    }

    // ── Fuzz ─────────────────────────────────────────────────────────────────

    function testFuzz_MintAndBurn(uint96 amount) public {
        vm.assume(amount > 0);
        vm.prank(minter);
        token.mint(user, amount, ORDER_ID);
        assertEq(token.balanceOf(user), amount);

        vm.prank(user);
        token.burnForRedemption(amount, ORDER_ID);
        assertEq(token.balanceOf(user), 0);
    }
}
