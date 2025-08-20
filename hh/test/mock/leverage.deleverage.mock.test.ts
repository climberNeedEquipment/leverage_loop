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

    // Deploy Mock ERC20 tokens
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

    // Set mock prices for the dynamically deployed tokens
    const mockPrices = new Map<string, number>();
    mockPrices.set((await weth.getAddress()).toLowerCase(), 3500); // 1 WETH = 3500 USD
    mockPrices.set((await usdc.getAddress()).toLowerCase(), 1); // 1 USDC = 1 USD
    EisenMockApi.setMockPrices(mockPrices);

    // Deploy Mock Aave V3 Pool
    const MockAaveV3PoolFactory = (await ethers.getContractFactory(
      "MockAaveV3Pool",
      deployer
    )) as MockAaveV3Pool__factory;
    mockAavePool = await MockAaveV3PoolFactory.deploy();
    await mockAavePool.waitForDeployment();

    // Set aToken and vDebt addresses in mock Aave pool
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

    // Deploy Mock Eisen Router
    const MockEisenRouterFactory = (await ethers.getContractFactory(
      "MockEisenRouter",
      deployer
    )) as MockEisenRouter__factory;
    mockEisenRouter = await MockEisenRouterFactory.deploy();
    await mockEisenRouter.waitForDeployment();

    // Set minters for mock tokens
    await weth.setMinter(deployer.address);
    await usdc.setMinter(deployer.address);
    await aWETH.setMinter(await mockAavePool.getAddress());
    await vUSDC.setMinter(await mockAavePool.getAddress());

    // Set mock swap rates in Eisen Router
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

    // Fund mock Aave pool with WETH and USDC
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

    // Fund user with initial WETH
    await weth.mint(user.address, ethers.parseEther("10")); // 10 WETH

    // Deploy LeverageLoop contract
    const LeverageLoopFactory = (await ethers.getContractFactory(
      "LeverageLoop",
      deployer
    )) as LeverageLoop__factory;
    leverageLoop = await LeverageLoopFactory.deploy(
      await mockAavePool.getAddress(),
      await mockEisenRouter.getAddress()
    );
    await leverageLoop.waitForDeployment();

    // User enables WETH as collateral
    await mockAavePool.setUserUseReserveAsCollateral(
      await weth.getAddress(),
      true
    );

    // Approve tokens for LeverageLoop contract
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
    const targetLeverage = 2.0; // 2x leverage

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

    await leverageLoop.connect(user).executeLeverageLoop(leverageParams);

    const aBal = await aWETH.balanceOf(user.address);
    const vBal = await vUSDC.balanceOf(user.address);
    console.log(`Leverage - aWETH Balance: ${ethers.formatEther(aBal)}`);
    console.log(
      `Leverage - vUSDC Balance: ${ethers.formatUnits(vBal, USDC_DECIMALS)}`
    );

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
    expect(aBalAfter).to.not.equal(initialACollateral);
    expect(vBalAfter).to.not.equal(initialVDebt);
    expect(aBalAfter).to.be.lt(initialACollateral);
    expect(vBalAfter).to.be.lt(initialVDebt);
  });
});
