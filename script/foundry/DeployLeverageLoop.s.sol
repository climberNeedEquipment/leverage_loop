// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "../../src/LeverageLoop.sol";

contract DeployLeverageLoop is Script {
    function run() public returns (LeverageLoop) {
        vm.startBroadcast();

        // Replace these with actual values for Kaia chain
        address aaveV3Pool = address(
            0xCf1af042f2A071DF60a64ed4BdC9c7deE40780Be
        );
        address eisenRouter = address(
            0x849f4620c597380511eA012E34AD0a453dD18b3c
        );

        LeverageLoop leverageLoop = new LeverageLoop(aaveV3Pool, eisenRouter);
        vm.stopBroadcast();
        return leverageLoop;
    }
}
