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

      const scaledPriceOfCollateral = priceOfCollateral; // Already EXP18 scaled
      const scaledPriceOfDebt = priceOfDebt; // Already EXP18 scaled
      const scaledFlashloanPremium = flashloanPremium; // Already EXP18 scaled

      // Convert initial amounts to EXP18-scaled values for arithmetic with prices
      const flashloanDebtValueNeeded =
        ((targetLeverageBigInt - EXP18) *
          (collateralAmount + initialCollateralAmount) *
          priceOfCollateral *
          debtDecimalsBigInt) /
        priceOfDebt /
        EXP18 /
        collateralDecimalsBigInt;

      if (flashloanDebtValueNeeded < 0) {
        throw new Error(
          "Calculated flashloan debt value is negative. Target leverage is too low or initial debt too high for a leverage operation."
        );
      }

      // Convert flashloan debt value to actual borrow asset amount (native decimals)
      const calculatedFlashloanCollateralAmount =
        (flashloanDebtValueNeeded *
          scaledPriceOfDebt *
          collateralDecimalsBigInt) /
        (scaledPriceOfCollateral * debtDecimalsBigInt);

      // Adjust flashloan amount for premium (premium is on the borrowed amount)
      const flashloanAmountWithPremium =
        (flashloanDebtValueNeeded * (EXP18 + scaledFlashloanPremium)) / EXP18;

      // Calculate new total collateral and debt for post-leverage display (in native decimals)
      const newCollateralFromSwapAmount = calculatedFlashloanCollateralAmount;

      const postLeverageCollateralAmount =
        initialCollateralAmount +
        collateralAmount +
        newCollateralFromSwapAmount;
      const postLeverageDebtAmount =
        initialDebtAmount + flashloanDebtValueNeeded;

      // Recalculate LTV for display after all operations
      const finalTotalCollateralValue =
        (postLeverageCollateralAmount * scaledPriceOfCollateral) /
        collateralDecimalsBigInt;
      const finalTotalDebtValue =
        (postLeverageDebtAmount * scaledPriceOfDebt) / debtDecimalsBigInt;
      const ltv = (finalTotalDebtValue * EXP18) / finalTotalCollateralValue; // LTV calculation using final values

      return {
        flashloanAmount: flashloanDebtValueNeeded, // Return the flashloan amount including premium
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
    targetDeLeverage: number, // Ratio from 0.0 to 1.0 (e.g., 0.5 for 50% reduction)
    flashloanPremium: bigint
  ): CalculatedDeleverageData {
    const EXP18 = ethers.parseEther("1");
    const targetDeLeverageBigInt = ethers.parseEther(
      targetDeLeverage.toString()
    ); // This is interpreted as a percentage of debt to reduce
    const collateralDecimalsBigInt = 10n ** BigInt(collateralDecimals);
    const debtDecimalsBigInt = 10n ** BigInt(debtDecimals);

    if (convertCollateralAmount && convertDebtAmount) {
      // convert collateral amount and convert debt amount are provided
      // Use amounts directly in calculations (inverse price correlation)

      const flashloanAmount = convertCollateralAmount; // Flashloan collateral to convert to debt for repayment

      const postDeleverageCollateralAmount =
        initialCollateralAmount - convertCollateralAmount; // User's collateral decreases by converted amount
      const postDeleverageDebtAmount = initialDebtAmount - convertDebtAmount; // User's debt decreases by converted amount

      // Ensure amounts are not negative
      if (postDeleverageCollateralAmount < 0 || postDeleverageDebtAmount < 0) {
        throw new Error("Deleverage results in negative collateral or debt.");
      }

      // Recalculate LTV for display based on new amounts (using assumed conversion ratio)
      // This calculation is tricky without explicit prices, assuming convertDebtAmount / convertCollateralAmount is the implied ratio
      const impliedPriceRatio =
        (convertDebtAmount * EXP18) / convertCollateralAmount; // Borrow asset per collateral asset in EXP18

      const currentCollateralValue =
        (initialCollateralAmount * impliedPriceRatio) / EXP18; // Value in borrow asset terms
      const currentDebtValue = initialDebtAmount;

      const newCollateralValue =
        (postDeleverageCollateralAmount * impliedPriceRatio) / EXP18;
      const newDebtValue = postDeleverageDebtAmount;

      const ltv = (newDebtValue * EXP18) / newCollateralValue; // LTV using value terms

      return {
        flashloanAmount,
        ltv,
        collateralAmount: postDeleverageCollateralAmount,
        debtAmount: postDeleverageDebtAmount,
      } as CalculatedDeleverageData;
    } else if (priceOfCollateral && priceOfDebt) {
      // price of collateral and price of debt are provided

      let flashloanAmount =
        ((EXP18 - targetDeLeverageBigInt) *
          initialDebtAmount *
          priceOfDebt *
          collateralDecimalsBigInt) /
        priceOfCollateral /
        EXP18 /
        debtDecimalsBigInt;

      if (flashloanAmount < 0) {
        flashloanAmount = 0n;
      }

      // Calculate final post-deleverage collateral and debt amounts (in native decimals)
      const postDeleverageCollateralAmount =
        initialCollateralAmount -
        ((EXP18 + flashloanPremium) * flashloanAmount) / EXP18; // User's collateral decreases by the flashloaned amount + premium
      const postDeleverageDebtAmount =
        initialDebtAmount -
        (priceOfCollateral * flashloanAmount * collateralDecimalsBigInt) /
          (priceOfDebt * debtDecimalsBigInt); // User's debt decreases by the repaid amount

      // Ensure amounts are not negative
      if (postDeleverageCollateralAmount < 0 || postDeleverageDebtAmount < 0) {
        throw new Error(
          "Deleverage results in negative collateral or debt. Adjust target deleverage."
        );
      }

      const ltv =
        (priceOfDebt *
          postDeleverageDebtAmount *
          EXP18 *
          collateralDecimalsBigInt) /
        (priceOfCollateral * postDeleverageCollateralAmount) /
        debtDecimalsBigInt; // LTV calculation using final values

      return {
        flashloanAmount,
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
    flashloanPremium: bigint,
    collateralDecimals: number,
    debtDecimals: number
  ): number {
    const EXP18 = ethers.parseEther("1");

    const collateralDecimalsBigInt = 10n ** BigInt(collateralDecimals);
    const debtDecimalsBigInt = 10n ** BigInt(debtDecimals);

    const maxLeverage =
      ((priceOfCollateral *
        (EXP18 + flashloanPremium) *
        (initialCollateralAmount + collateralAmount) *
        debtDecimalsBigInt -
        priceOfDebt * initialDebtAmount * EXP18 * collateralDecimalsBigInt) *
        EXP18) /
      (priceOfCollateral *
        (initialCollateralAmount + collateralAmount) *
        debtDecimalsBigInt *
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
