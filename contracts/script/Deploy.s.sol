// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/AurumToken.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployAurumToken is Script {
    function run() external {
        address adminMultisig = vm.envAddress("ADMIN_MULTISIG");
        address minterHotWallet = vm.envAddress("MINTER_HOT_WALLET");
        address pauserAddress = vm.envAddress("PAUSER_ADDRESS");

        vm.startBroadcast();

        AurumToken impl = new AurumToken();

        bytes memory initData = abi.encodeCall(
            AurumToken.initialize,
            (adminMultisig, minterHotWallet, pauserAddress)
        );

        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);

        vm.stopBroadcast();

        console.log("AurumToken implementation:", address(impl));
        console.log("AurumToken proxy (use this):", address(proxy));
    }
}
