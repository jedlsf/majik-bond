import Decimal from "decimal.js";
import { PriceMode } from "./enums";
import { MajikBond } from "./majik-bond";
import { DayCountCalculator } from "./utils";
import { YTMCurvePlot } from "./types";


/**
 * BondPricing contains all calculation logic for bonds.
 * MajikBond should delegate pricing, YTM, and sensitivity calculations here.
 */
export class BondPricing {
    /**
     * Compute bond price given a discount rate and price mode.
     * @param bond - MajikBond instance
     * @param rate - discount rate (default: bond.marketRate)
     * @param asOfDate - valuation date (ISO string)
     * @param mode - PriceMode (Clean or Dirty)
     */
    static computePrice(
        bond: MajikBond,
        rate: number = bond.marketRate,
        asOfDate: string = new Date().toISOString(),
        mode: PriceMode = PriceMode.Clean
    ): number {
        const valuationDate = new Date(asOfDate);
        const schedule = bond.generateCouponSchedule(); // Use MajikBond's method
        const faceMaj = bond.faceValue.toMajorDecimal();
        const couponMaj = faceMaj.mul(bond.couponRate).div(bond.frequency);
        const rateDec = new Decimal(rate);
        const baseRate = new Decimal(1).add(rateDec.div(bond.frequency));
        let priceMaj = new Decimal(0);

        schedule.forEach((couponDate) => {
            const t = DayCountCalculator.yearFraction(valuationDate, couponDate, bond.dayCount) * bond.frequency;
            if (t <= 0) return;
            priceMaj = priceMaj.add(couponMaj.div(baseRate.pow(t)));
        });

        // Add discounted face value
        const totalPeriods = DayCountCalculator.yearFraction(valuationDate, schedule[schedule.length - 1], bond.dayCount) * bond.frequency;
        priceMaj = priceMaj.add(faceMaj.div(baseRate.pow(totalPeriods)));

        const ratioClean = priceMaj.div(faceMaj);

        // Dirty price includes accrued interest
        if (mode === PriceMode.Dirty) {
            const accruedMaj = bond.getAccruedInterest(asOfDate).toMajorDecimal();
            return priceMaj.add(accruedMaj).div(faceMaj).toNumber();
        }

        return ratioClean.toNumber();
    }

    /**
     * Compute market rate (YTM) based on current price.
     * @param bond - MajikBond instance
     */
    static computeMarketRate(bond: MajikBond): number {
        const accruedMaj = bond.getAccruedInterest().toMajorDecimal();
        const faceMaj = bond.faceValue.toMajorDecimal();
        const priceDec = bond.priceMode === PriceMode.Clean
            ? new Decimal(bond.price.buy)
            : new Decimal(bond.price.buy).add(accruedMaj.div(faceMaj));

        return this.solveYTMFromPrice(bond, priceDec.toNumber(), bond.maturity.years);
    }


    // --- Yield to Maturity (YTM) ---

    static solveYTMFromPrice(
        bond: MajikBond,
        priceRatio: number = bond.price.buy,
        maturityYears: number = bond.maturity.years,
        iterations = 100,
        tolerance = 1e-12
    ): number {
        if (maturityYears <= 0) return 0;

        const freqDec = new Decimal(bond.frequency);
        const faceMaj = bond.faceValue.toMajorDecimal();
        const couponMaj = faceMaj.mul(bond.couponRate).div(freqDec);
        const priceDec = new Decimal(priceRatio);

        let ytmDec = new Decimal(bond.marketRate || bond.couponRate);
        const periods = new Decimal(maturityYears).mul(freqDec);

        for (let i = 0; i < iterations; i++) {
            let f = new Decimal(0);
            let df = new Decimal(0);

            for (let t = new Decimal(1); t.lte(periods); t = t.add(1)) {
                const discountBase = new Decimal(1).add(ytmDec.div(freqDec));
                const discount = discountBase.pow(t);
                f = f.add(couponMaj.div(discount));
                df = df.sub(t.mul(couponMaj).div(discount.mul(discountBase).mul(freqDec)));
            }

            const discountBaseFinal = new Decimal(1).add(ytmDec.div(freqDec));
            const discountFinal = discountBaseFinal.pow(periods);
            f = f.add(faceMaj.div(discountFinal).sub(faceMaj.mul(priceDec)));
            df = df.sub(periods.mul(faceMaj).div(discountFinal.mul(discountBaseFinal).mul(freqDec)));

            if (df.abs().lt(new Decimal('1e-30'))) break;

            const next = ytmDec.sub(f.div(df));
            if (!next.isFinite()) break;
            if (next.sub(ytmDec).abs().lt(new Decimal(tolerance))) {
                ytmDec = next;
                break;
            }
            ytmDec = next;
        }

        return ytmDec.toNumber();
    }

    // --- Duration & Sensitivity ---


    /**
    * Macaulay Duration (clean-price basis).
    * Accrued interest is excluded by design.
    */
    static getDuration(bond: MajikBond): number {
        const faceMaj = bond.faceValue.toMajorDecimal();
        const couponMaj = faceMaj.mul(bond.couponRate).div(bond.frequency);

        let weightedSum = new Decimal(0);
        let pvTotal = new Decimal(0);
        const baseRate = new Decimal(1).add(new Decimal(bond.marketRate).div(bond.frequency));

        for (let t = 1; t <= bond.totalPeriods; t++) {
            const discount = baseRate.pow(new Decimal(t));
            const pv = couponMaj.div(discount);
            weightedSum = weightedSum.add(pv.mul(t));
            pvTotal = pvTotal.add(pv);
        }

        const pvFace = faceMaj.div(baseRate.pow(new Decimal(bond.totalPeriods)));
        weightedSum = weightedSum.add(pvFace.mul(bond.totalPeriods));
        pvTotal = pvTotal.add(pvFace);

        if (pvTotal.equals(0)) return 0;
        return weightedSum.div(pvTotal).div(bond.frequency).toNumber();
    }

    static getModifiedDuration(bond: MajikBond): number {
        return this.getDuration(bond) / (1 + bond.marketRate / bond.frequency);
    }

    // --- Investment Planning ---

    static getRequiredInvestmentForMonthlyIncome(bond: MajikBond, targetMonthly: number): number {
        const faceMaj = bond.faceValue.toMajorDecimal();
        const annualIncomePerBondMaj = faceMaj.mul(bond.couponRate);
        const monthlyIncomePerBondMaj = annualIncomePerBondMaj.div(12);

        if (monthlyIncomePerBondMaj.equals(0)) return 0;

        const bondsNeeded = new Decimal(targetMonthly).div(monthlyIncomePerBondMaj);
        const investmentMaj = faceMaj.mul(bond.price.buy).mul(bondsNeeded);
        return investmentMaj.toNumber();
    }



    /**
    * Compute a YTM curve for the bond across different maturities.
    * Returns Plotly-ready curve data.
    */
    static computeYTMCurve(
        bond: MajikBond,
        options?: {
            points?: number;
            smoothing?: number;
            name?: string;
        }
    ): YTMCurvePlot[] {
        const points = options?.points ?? 10;
        const smoothing = options?.smoothing ?? 0.8;

        const maturities: number[] = [];
        const ytms: number[] = [];

        const minYears = 1 / bond.frequency;

        for (let i = 1; i <= points; i++) {
            const maturityYears = Math.max(
                minYears,
                (bond.maturity.years / points) * i
            );

            maturities.push(maturityYears);

            ytms.push(
                BondPricing.solveYTMFromPrice(
                    bond,
                    bond.price.buy,
                    maturityYears
                )
            );
        }

        return [
            {
                x: maturities,
                y: ytms,
                type: "scatter",
                mode: "lines+markers",
                name: options?.name ?? "YTM Curve",
                line: {
                    shape: "spline",
                    smoothing,
                    width: 2,
                },
                marker: { size: 6 },
                hovertemplate:
                    "Maturity: %{x:.2f} yrs<br>YTM: %{y:.2%}<extra></extra>",
            },
        ];
    }


}
