import { ethers } from "ethers";

export interface LeverageParams {
  collateralAmount: bigint;
  targetLeverage: number; // e.g., 2.5 for 2.5x leverage
}

export interface CalculatedLeverageData {
  flashloanAmount: bigint;
  ltv: bigint;
  collateralAmount: bigint;
  debtAmount: bigint;
}

export interface CalculatedDeleverageData {
  flashloanAmount: bigint;
  ltv: bigint;
  collateralAmount: bigint;
  debtAmount: bigint;
}

/**
 * Calculate optimal leverage parameters for a given position
 */
export class LeverageCalculator {
  private static readonly PRECISION = 1e18;
  private static readonly MAX_LTV = 0.8; // 80% max LTV
  private static readonly LIQUIDATION_THRESHOLD = 0.85; // 85% liquidation threshold

  /**
   * Calculate leverage parameters based on target leverage
   */
  static calculateLeverageParams(
    initialCollateralAmount: bigint,
    initialDebtAmount: bigint,
    convertCollateralAmount: bigint | undefined,
    convertDebtAmount: bigint | undefined,
    priceOfCollateral: bigint | undefined, // decimals 18
    priceOfDebt: bigint | undefined, // decimals 18
    collateralDecimals: number,
    debtDecimals: number,
    collateralAmount: bigint,
    targetLeverage: number,
    flashloanPremium: bigint
  ): CalculatedLeverageData {
    const EXP18 = ethers.parseEther("1");

    const targetLeverageBigInt = ethers.parseEther(targetLeverage.toString());
    const collateralDecimalsBigInt = 10n ** BigInt(collateralDecimals);
    const debtDecimalsBigInt = 10n ** BigInt(debtDecimals);

    if (convertCollateralAmount && convertDebtAmount) {
      // convert collateral amount and convert debt amount are provided
      // Use amounts directly in calculations (inverse price correlation)

      const flashloanAmount = convertDebtAmount;
      const ltv =
        (convertCollateralAmount *
          (initialDebtAmount * EXP18 +
            (EXP18 + flashloanPremium) * convertDebtAmount) *
          EXP18) /
        ((initialCollateralAmount +
          convertCollateralAmount +
          collateralAmount) *
          convertDebtAmount *
          EXP18);

      const postLeverageCollateralAmount =
        initialCollateralAmount + convertCollateralAmount + collateralAmount;
      const postLeverageDebtAmount =
        initialDebtAmount +
        ((EXP18 + flashloanPremium) * convertDebtAmount) / EXP18;

      return {
        flashloanAmount,
        ltv,
        collateralAmount: postLeverageCollateralAmount,
        debtAmount: postLeverageDebtAmount,
      } as CalculatedLeverageData;
    } else if (priceOfCollateral && priceOfDebt) {
      // price of collateral and price of debt are provided
      // Calculate the flashloan amount needed to achieve the target leverage
      // The formula aims to achieve: (Current Debt + Flashloan Amount) * PriceOfDebt / (Current Collateral + Converted Flashloan Amount) / PriceOfCollateral = Target LTV

      // All values are scaled to EXP18 (1e18) for consistent arithmetic
      const scaledPriceOfCollateral = priceOfCollateral;
      const scaledPriceOfDebt = priceOfDebt;
      const scaledFlashloanPremium = flashloanPremium;
      const scaledInitialCollateralAmount = initialCollateralAmount;
      const scaledInitialDebtAmount = initialDebtAmount;
      const scaledCollateralAmount = collateralAmount; // New collateral being supplied

      // Total collateral after initial supply and new supply
      const totalCollateralAfterSupply =
        scaledInitialCollateralAmount + scaledCollateralAmount;

      // Target Debt based on target leverage and total collateral (after new supply)
      // Target LTV = 1 - (1 / Target Leverage)
      const targetLTV = EXP18 - (EXP18 * EXP18) / targetLeverageBigInt;

      // The amount of debt we can sustain with the new collateral + current collateral
      const maximumSustainableDebt =
        (totalCollateralAfterSupply * scaledPriceOfCollateral * targetLTV) /
        (scaledPriceOfDebt * EXP18);

      // Flashloaned debt amount is the difference between max sustainable debt and current debt
      const calculatedFlashloanDebtAmount =
        maximumSustainableDebt - scaledInitialDebtAmount;

      // Ensure calculatedFlashloanDebtAmount is not negative, it might be if initial debt is too high or target leverage too low
      if (calculatedFlashloanDebtAmount < 0) {
        throw new Error(
          "Calculated flashloan debt amount is negative. Adjust initial parameters or target leverage."
        );
      }

      // Convert flashloaned debt amount to equivalent collateral amount for flashloan
      const flashloanAmount =
        (calculatedFlashloanDebtAmount * scaledPriceOfDebt) /
        scaledPriceOfCollateral; // This is the amount of collateral to flashloan (in collateral token terms)

      // Adjust flashloan amount for premium
      const flashloanAmountWithPremium =
        flashloanAmount +
        (calculatedFlashloanDebtAmount * scaledFlashloanPremium) / EXP18; // Premium in collateral terms

      // Calculate new LTV based on the new state
      const newTotalCollateral = totalCollateralAfterSupply + flashloanAmount; // Total collateral after swap
      const newTotalDebt =
        scaledInitialDebtAmount +
        calculatedFlashloanDebtAmount +
        (calculatedFlashloanDebtAmount * scaledFlashloanPremium) / EXP18; // Total debt after borrow and premium

      const ltv =
        (newTotalDebt * scaledPriceOfDebt * EXP18) /
        (newTotalCollateral * scaledPriceOfCollateral); // LTV using full amounts

      const postLeverageCollateralAmount =
        initialCollateralAmount +
        collateralAmount +
        (priceOfDebt * flashloanAmount * debtDecimalsBigInt) /
          priceOfCollateral /
          collateralDecimalsBigInt;
      const postLeverageDebtAmount =
        initialDebtAmount +
        ((EXP18 + flashloanPremium) * flashloanAmount) / EXP18;

      return {
        flashloanAmount: flashloanAmountWithPremium, // Return the flashloan amount including premium
        ltv,
        collateralAmount: postLeverageCollateralAmount,
        debtAmount: postLeverageDebtAmount,
      } as CalculatedLeverageData;
    }

    // If neither case applies, throw an error
    throw new Error(
      "Either convertCollateralAmount and convertDebtAmount, or priceOfCollateral and priceOfDebt must be provided"
    );
  }

  /**
   * Calculate deleverage parameters
   */
  static calculateDeleverageParams(
    initialCollateralAmount: bigint,
    initialDebtAmount: bigint,
    convertCollateralAmount: bigint | undefined,
    convertDebtAmount: bigint | undefined,
    priceOfCollateral: bigint | undefined, // decimals 18
    priceOfDebt: bigint | undefined, // decimals 18
    collateralDecimals: number,
    debtDecimals: number,
    targetDeLeverage: number,
    flashloanPremium: bigint
  ): CalculatedDeleverageData {
    const EXP18 = ethers.parseEther("1");
    const targetDeLeverageBigInt = ethers.parseEther(
      targetDeLeverage.toString()
    );
    const collateralDecimalsBigInt = 10n ** BigInt(collateralDecimals);
    const debtDecimalsBigInt = 10n ** BigInt(debtDecimals);

    if (convertCollateralAmount && convertDebtAmount) {
      // convert collateral amount and convert debt amount are provided
      // Use amounts directly in calculations (inverse price correlation)

      const flashloanAmount = convertCollateralAmount;

      const ltv =
        ((initialDebtAmount - convertDebtAmount) *
          convertCollateralAmount *
          EXP18 *
          EXP18) /
        ((initialCollateralAmount * EXP18 -
          (EXP18 + flashloanPremium) * convertCollateralAmount) *
          convertDebtAmount);
      const postDeleverageCollateralAmount =
        initialCollateralAmount -
        ((EXP18 + flashloanPremium) * convertCollateralAmount) / EXP18;
      const postDeleverageDebtAmount = initialDebtAmount - convertDebtAmount;

      return {
        flashloanAmount,
        ltv,
        collateralAmount: postDeleverageCollateralAmount,
        debtAmount: postDeleverageDebtAmount,
      } as CalculatedDeleverageData;
    } else if (priceOfCollateral && priceOfDebt) {
      // price of collateral and price of debt are provided
      // All values are scaled to EXP18 (1e18) for consistent arithmetic
      const scaledPriceOfCollateral = priceOfCollateral;
      const scaledPriceOfDebt = priceOfDebt;
      const scaledFlashloanPremium = flashloanPremium;
      const scaledInitialCollateralAmount = initialCollateralAmount;
      const scaledInitialDebtAmount = initialDebtAmount;
      const scaledTargetDeLeverage = targetDeLeverageBigInt; // assuming this is a ratio, e.g., 0.5 for 50% reduction

      // Calculate the target debt amount after deleverage
      const targetDebtAmount =
        (scaledInitialDebtAmount * scaledTargetDeLeverage) / EXP18;

      // Calculate the amount of debt to repay
      const debtToRepay = scaledInitialDebtAmount - targetDebtAmount;

      // Ensure debtToRepay is not negative
      if (debtToRepay < 0) {
        throw new Error(
          "Debt to repay is negative. Adjust initial parameters or target deleverage."
        );
      }

      // Flashloan amount is the collateral needed to repay `debtToRepay`
      const flashloanAmount =
        (debtToRepay * scaledPriceOfDebt) / scaledPriceOfCollateral; // This is the amount of collateral to flashloan

      // Adjust flashloan amount for premium
      const flashloanAmountWithPremium =
        flashloanAmount + (debtToRepay * scaledFlashloanPremium) / EXP18; // Premium calculated on debtToRepay converted to collateral terms

      // Calculate new LTV based on the new state
      const newTotalCollateral =
        scaledInitialCollateralAmount - flashloanAmountWithPremium; // Collateral after withdrawal
      const newTotalDebt =
        scaledInitialDebtAmount -
        debtToRepay -
        (debtToRepay * scaledFlashloanPremium) / EXP18; // Debt after repayment and premium

      const ltv =
        (newTotalDebt * scaledPriceOfDebt * EXP18) /
        (newTotalCollateral * scaledPriceOfCollateral); // LTV using full amounts

      const postDeleverageCollateralAmount = newTotalCollateral;
      const postDeleverageDebtAmount = newTotalDebt;

      return {
        flashloanAmount: flashloanAmountWithPremium,
        ltv,
        collateralAmount: postDeleverageCollateralAmount,
        debtAmount: postDeleverageDebtAmount,
      } as CalculatedDeleverageData;
    }

    // If neither case applies, throw an error
    throw new Error(
      "Either convertCollateralAmount and convertDebtAmount, or priceOfCollateral and priceOfDebt must be provided"
    );
  }

  static calculateMaxLeverageMultiplier(
    initialCollateralAmount: bigint,
    initialDebtAmount: bigint,
    priceOfCollateral: bigint, // decimals 18
    priceOfDebt: bigint, // decimals 18
    collateralAmount: bigint,
    maxLTV: bigint,
    flashloanPremium: bigint
  ): number {
    const EXP18 = ethers.parseEther("1");

    const maxLeverage =
      (priceOfCollateral * priceOfCollateral * (EXP18 + flashloanPremium) -
        (priceOfDebt * priceOfDebt * initialDebtAmount * EXP18) /
          (initialCollateralAmount + collateralAmount)) /
      (priceOfCollateral *
        priceOfCollateral *
        (EXP18 + flashloanPremium - maxLTV));

    const maxLeverageNumber = Number(ethers.formatEther(maxLeverage));

    return maxLeverageNumber;
  }

  /**
   * Validate leverage parameters for safety
   */
  static validateLeverageParams(
    leverageParams: CalculatedLeverageData,
    collateralAmount: bigint,
    targetLeverage: number
  ): boolean {
    // Check if leverage is within safe bounds
    if (targetLeverage > 1 / (1 - this.MAX_LTV)) {
      console.warn(`Target leverage ${targetLeverage} exceeds safe maximum`);
      return false;
    }

    // Check if flashloan amount is reasonable
    const maxFlashloan =
      (collateralAmount * BigInt(Math.floor(targetLeverage * 100))) / 100n;
    if (leverageParams.flashloanAmount > maxFlashloan) {
      console.warn("Flashloan amount too high");
      return false;
    }

    return true;
  }
}
