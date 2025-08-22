import { ethers } from "hardhat";
import { expect } from "chai";
import { Signer } from "ethers";
import {
  MockERC20Mintable,
  MockERC20Mintable__factory,
  MockAaveV3Pool,
  MockAaveV3Pool__factory,
  MockEisenRouter,
  MockEisenRouter__factory,
  LeverageLoop,
  LeverageLoop__factory,
  MockAToken,
  MockAToken__factory,
  MockVariableDebtToken,
  MockVariableDebtToken__factory,
} from "../../typechain-types";
import { EXP18, LeverageCalculator } from "../../utils/leverageCalculator";
import { EisenMockApi } from "../../utils/eisenMockApi";
import { IWETH } from "../../typechain-types/contracts/interfaces/IWETH";

describe("Hardhat Mock Tests - Leverage and Deleverage", function () {
  let deployer: Signer;
  let user: Signer;
  let weth: MockERC20Mintable;
  let usdc: MockERC20Mintable;
  let aWETH: MockAToken;
  let vUSDC: MockVariableDebtToken;
  let mockAavePool: MockAaveV3Pool;
  let mockEisenRouter: MockEisenRouter;
  let leverageLoop: LeverageLoop;

  const USDC_DECIMALS = 6;

  before(async function () {
    [deployer, user] = await ethers.getSigners();

    // 1. Deploy all Mock Token Factories
    const MockERC20MintableFactory = (await ethers.getContractFactory(
      "MockERC20Mintable",
      deployer
    )) as MockERC20Mintable__factory;
    const MockATokenFactory = (await ethers.getContractFactory(
      "MockAToken",
      deployer
    )) as MockAToken__factory;
    const MockVariableDebtTokenFactory = (await ethers.getContractFactory(
      "MockVariableDebtToken",
      deployer
    )) as MockVariableDebtToken__factory;

    // 2. Deploy all Mock Tokens
    weth = await MockERC20MintableFactory.deploy("Wrapped Ether", "WETH", 18);
    await weth.waitForDeployment();
    usdc = await MockERC20MintableFactory.deploy("USD Coin", "USDC", 6);
    await usdc.waitForDeployment();
    aWETH = await MockATokenFactory.deploy("Aave WETH", "aWETH", 18);
    await aWETH.waitForDeployment();
    vUSDC = await MockVariableDebtTokenFactory.deploy(
      "Aave Variable Debt USDC",
      "vUSDC",
      6
    );
    await vUSDC.waitForDeployment();

    // 3. Deploy Mock Aave V3 Pool and Mock Eisen Router
    const MockAaveV3PoolFactory = (await ethers.getContractFactory(
      "MockAaveV3Pool",
      deployer
    )) as MockAaveV3Pool__factory;
    mockAavePool = await MockAaveV3PoolFactory.deploy();
    await mockAavePool.waitForDeployment();

    const MockEisenRouterFactory = (await ethers.getContractFactory(
      "MockEisenRouter",
      deployer
    )) as MockEisenRouter__factory;
    mockEisenRouter = await MockEisenRouterFactory.deploy();
    await mockEisenRouter.waitForDeployment();

    // 4. Set initial minters
    await weth.setMinter(deployer.address); // Deployer is initial minter for WETH
    await usdc.setMinter(deployer.address); // Deployer is initial minter for USDC
    await aWETH.setMinter(await mockAavePool.getAddress()); // mockAavePool is minter for aTokens
    await vUSDC.setMinter(await mockAavePool.getAddress()); // mockAavePool is minter for vDebtTokens

    // 5. List reserves in mock Aave pool
    await mockAavePool.listReserve(
      await weth.getAddress(),
      await aWETH.getAddress(),
      ethers.ZeroAddress, // No stable debt token for WETH
      18 // WETH decimals
    );
    await mockAavePool.listReserve(
      await usdc.getAddress(),
      ethers.ZeroAddress, // No aToken for USDC (if only variable debt is mocked for USDC)
      await vUSDC.getAddress(),
      6 // USDC decimals
    );

    // 6. Fund mock Aave pool with WETH and USDC (deployer mints and funds)
    await weth.mint(deployer.address, ethers.parseEther("1000")); // Mint some WETH to deployer to fund pool
    await weth.approve(
      await mockAavePool.getAddress(),
      ethers.parseEther("1000")
    );
    await mockAavePool.fund(await weth.getAddress(), ethers.parseEther("1000"));

    await usdc.mint(
      deployer.address,
      ethers.parseUnits("1000000", USDC_DECIMALS)
    ); // Mint some USDC to deployer to fund pool
    await usdc.approve(
      await mockAavePool.getAddress(),
      ethers.parseUnits("1000000", USDC_DECIMALS)
    );
    await mockAavePool.fund(
      await usdc.getAddress(),
      ethers.parseUnits("1000000", USDC_DECIMALS)
    );

    // 7. Fund user with initial WETH (deployer mints to user)
    await weth.mint(user.address, ethers.parseEther("10")); // 10 WETH

    // 8. Now, transfer minter role of WETH and USDC to mockAavePool for flashloan minting during executeOperation
    await weth.setMinter(await mockAavePool.getAddress());
    await usdc.setMinter(await mockAavePool.getAddress());

    // 9. Set mock prices for the dynamically deployed tokens
    const mockPrices = new Map<string, number>();
    mockPrices.set((await weth.getAddress()).toLowerCase(), 3500); // 1 WETH = 3500 USD
    mockPrices.set((await usdc.getAddress()).toLowerCase(), 1); // 1 USDC = 1 USD
    EisenMockApi.setMockPrices(mockPrices);

    // 10. Set mock swap rates in Eisen Router
    await mockEisenRouter.setDefaultPair(
      await weth.getAddress(),
      await usdc.getAddress()
    );
    await mockEisenRouter.setSwapRate(
      await weth.getAddress(),
      await usdc.getAddress(),
      ethers.parseEther("2000"), // num (2000 USDC equivalent to 1 WETH)
      ethers.parseEther("1") // den (1 WETH)
    ); // 1 WETH = 2000 USDC

    // 11. Deploy LeverageLoop contract
    const LeverageLoopFactory = (await ethers.getContractFactory(
      "LeverageLoop",
      deployer
    )) as LeverageLoop__factory;
    leverageLoop = await LeverageLoopFactory.deploy(
      await mockAavePool.getAddress(),
      // Use a special address to signal to LeverageLoop to bypass real router logic in mock tests
      "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF"
    );
    await leverageLoop.waitForDeployment();

    // 12. User enables WETH as collateral
    await mockAavePool.setUserUseReserveAsCollateral(
      await weth.getAddress(),
      true
    );

    // 13. Approve tokens for LeverageLoop contract
    await weth
      .connect(user)
      .approve(await leverageLoop.getAddress(), ethers.MaxUint256);
    await usdc
      .connect(user)
      .approve(await leverageLoop.getAddress(), ethers.MaxUint256);
    await aWETH
      .connect(user)
      .approve(await leverageLoop.getAddress(), ethers.MaxUint256);
    await vUSDC
      .connect(user)
      .approve(await leverageLoop.getAddress(), ethers.MaxUint256);
  });

  it("should execute leverage and deleverage with mocks", async function () {
    const initialCollateralAmount = ethers.parseEther("1"); // 1 WETH initial collateral
    const additionalCollateralForLeverage = ethers.parseEther("0.5"); // 0.5 WETH new collateral for leverage
    const targetLeverage = 4.0; // 4x leverage (changed from 2.0 to ensure leverage operation)

    // Simulate initial supply of collateral by the user
    await weth
      .connect(user)
      .approve(await mockAavePool.getAddress(), initialCollateralAmount);
    await mockAavePool
      .connect(user)
      .supply(
        await weth.getAddress(),
        initialCollateralAmount,
        user.address,
        0
      );

    // Simulate initial borrow of USDC by the user
    const initialBorrowAmount = ethers.parseUnits("1000", USDC_DECIMALS); // Borrow 1000 USDC initially
    await mockAavePool.connect(user).borrow(
      await usdc.getAddress(),
      initialBorrowAmount,
      2, // Variable interest rate mode
      0,
      user.address
    );

    // Get initial balances before leverage
    const initialACollateral = await aWETH.balanceOf(user.address);
    const initialVDebt = await vUSDC.balanceOf(user.address);

    console.log(
      `Initial - aWETH Balance: ${ethers.formatEther(initialACollateral)}`
    );
    console.log(
      `Initial - vUSDC Balance: ${ethers.formatUnits(
        initialVDebt,
        USDC_DECIMALS
      )}`
    );

    // Calculate leverage parameters using mock prices
    const collateralPrice = ethers.parseEther("2000"); // 1 WETH = 2000 USD
    const borrowPrice = ethers.parseEther("1"); // 1 USDC = 1 USD

    const leverageData = LeverageCalculator.calculateLeverageParams(
      initialACollateral, // User's current collateral in Aave
      initialVDebt, // User's current debt in Aave
      undefined,
      undefined,
      collateralPrice,
      borrowPrice,
      await weth.decimals(),
      await usdc.decimals(),
      additionalCollateralForLeverage, // This is the 'new' collateral being supplied for leverage
      targetLeverage,
      ethers.parseEther("0.0008") // Mock flashloan premium
    );

    // Prepare swap data (using mock Eisen Router)
    const swapPathData = await EisenMockApi.buildLeverageSwapDataFromQuote(
      await usdc.getAddress(), // fromToken
      await weth.getAddress(), // toToken
      leverageData.flashloanAmount, // fromAmount
      "0.01", // slippage (e.g., 1%)
      await leverageLoop.getAddress(), // recipient
      true // useMock
    );

    // Execute leverage loop
    const leverageParams = {
      aToken: await aWETH.getAddress(),
      variableDebtAsset: await vUSDC.getAddress(),
      collateralAsset: await weth.getAddress(),
      borrowAsset: await usdc.getAddress(),
      collateralAmount: additionalCollateralForLeverage, // This is the new collateral to be supplied in this step
      flashloanAmount: leverageData.flashloanAmount,
      swapPathData: swapPathData,
    };

    // Approve additional collateral for supply
    await weth
      .connect(user)
      .approve(
        await mockAavePool.getAddress(),
        additionalCollateralForLeverage
      );

    // Approve debt token for credit delegation
    await vUSDC
      .connect(user)
      .approveDelegation(await leverageLoop.getAddress(), ethers.MaxUint256);

    const leverageTx = await leverageLoop
      .connect(user)
      .executeLeverageLoop(leverageParams);
    const leverageReceipt = await leverageTx.wait();

    // Fetch and log DebugSupplyApproval event from transaction receipt
    const supplyEventInterface = new ethers.Interface([
      "event DebugSupplyApproval(address indexed collateralAsset, uint256 supplyAmount, uint256 contractBalance)",
    ]);
    const debugSupplyLog = leverageReceipt?.logs.find(
      (log) =>
        log.topics[0] ===
        supplyEventInterface.getEvent("DebugSupplyApproval").topic
    );

    if (debugSupplyLog) {
      const parsedLog = supplyEventInterface.parseLog(debugSupplyLog);
      console.log("--- DebugSupplyApproval Event ---");
      console.log(`Collateral Asset: ${parsedLog.args.collateralAsset}`);
      console.log(
        `Supply Amount: ${ethers.formatEther(parsedLog.args.supplyAmount)}`
      );
      console.log(
        `Contract Balance: ${ethers.formatEther(
          parsedLog.args.contractBalance
        )}`
      );
      console.log("-------------------------------");
    } else {
      console.log("--- DebugSupplyApproval Event: Not Found ---");
    }

    const aBal = await aWETH.balanceOf(user.address);
    const vBal = await vUSDC.balanceOf(user.address);
    console.log(`Leverage - aWETH Balance: ${ethers.formatEther(aBal)}`);
    console.log(
      `Leverage - vUSDC Balance: ${ethers.formatUnits(vBal, USDC_DECIMALS)}`
    );

    // Debugging MockEisenRouter values after leverage swap
    console.log("--- MockEisenRouter State After Leverage Swap ---");
    console.log(`lastTokenIn: ${await mockEisenRouter.getLastTokenIn()}`);
    console.log(`lastTokenOut: ${await mockEisenRouter.getLastTokenOut()}`);
    console.log(`lastAmountIn: ${await mockEisenRouter.getLastAmountIn()}`);
    console.log(`lastRNum: ${await mockEisenRouter.getLastRNum()}`);
    console.log(`lastRDen: ${await mockEisenRouter.getLastRDen()}`);
    console.log(`lastAmountOut: ${await mockEisenRouter.getLastAmountOut()}`);
    console.log("-------------------------------------------------");

    // Simulate deleverage operation
    // For deleverage, we'll aim to reduce debt significantly
    const targetDeLeverage = 0.5; // Reduce debt by 50% (example)
    const delevData = LeverageCalculator.calculateDeleverageParams(
      aBal, // current collateral
      vBal, // current debt
      undefined,
      undefined,
      collateralPrice,
      borrowPrice,
      await weth.decimals(),
      await usdc.decimals(),
      targetDeLeverage,
      ethers.parseEther("0.0008")
    );
    console.log(
      `Calculated deleverage flashloanAmount: ${ethers.formatEther(
        delevData.flashloanAmount
      )} WETH`
    );

    const deleverageSwapPathData =
      await EisenMockApi.buildLeverageSwapDataFromQuote(
        await weth.getAddress(), // fromToken
        await usdc.getAddress(), // toToken
        delevData.flashloanAmount, // fromAmount
        "0.01", // slippage (e.g., 1%)
        await leverageLoop.getAddress(), // recipient
        true // useMock
      );

    const deleverageParams = {
      aToken: await aWETH.getAddress(),
      collateralAsset: await weth.getAddress(),
      borrowAsset: await usdc.getAddress(),
      repayAmount: delevData.debtAmount, // Repay the calculated debt amount
      flashloanAmount: delevData.flashloanAmount, // Flashloan amount is the collateral to withdraw and swap
      withdrawCollateralAmount: delevData.collateralAmount, // Withdraw the calculated collateral amount
      swapPathData: deleverageSwapPathData,
    };

    await leverageLoop.connect(user).executeDeleverageLoop(deleverageParams);

    const aBalAfter = await aWETH.balanceOf(user.address);
    const vBalAfter = await vUSDC.balanceOf(user.address);
    console.log(
      `Deleverage - aWETH Balance After: ${ethers.formatEther(aBalAfter)}`
    );
    console.log(
      `Deleverage - vUSDC Balance After: ${ethers.formatUnits(
        vBalAfter,
        USDC_DECIMALS
      )}`
    );

    // Add assertions for final balances or LTV if desired
    expect(aBalAfter).to.be.lt(aBal); // Should be less than collateral before deleverage
    expect(vBalAfter).to.be.lt(vBal); // Should be less than debt before deleverage
  });
});
