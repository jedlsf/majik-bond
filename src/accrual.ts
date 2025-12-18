import Decimal from "decimal.js";
import { MajikBond } from "./majik-bond";
import { MajikMoney } from "@thezelijah/majik-money";
import { DayCountCalculator } from "./utils";

/**
 * BondAccrual
 *
 * Stateless engine responsible for accrued interest computation.
 * Handles:
 * - Coupon schedule lookup
 * - Day count convention
 * - Fractional periods
 * - Withholding tax on accrued interest
 *
 * DOES NOT mutate the bond.
 */
export class BondAccrual {

    /**
     * Computes accrued interest as of a given date.
     *
     * Accrued Interest =
     *   Face Value × Coupon Rate × Year Fraction since last coupon
     *
     * @param bond MajikBond instance
     * @param asOfDate ISO date string
     */
    static accruedInterest(
        bond: MajikBond,
        asOfDate: string = new Date().toISOString()
    ): MajikMoney {

        const valuationDate = new Date(asOfDate);

        // Generate coupon schedule
        const schedule = bond.generateCouponSchedule();

        if (!schedule.length) {
            return MajikMoney.fromMinor(0, bond.faceValue.currency.code);
        }

        // If before first coupon, no accrual
        if (valuationDate <= schedule[0]) {
            return MajikMoney.fromMinor(0, bond.faceValue.currency.code);
        }

        // Find last coupon date
        let lastCoupon = new Date(bond.maturity.start);
        for (const couponDate of schedule) {
            if (valuationDate < couponDate) break;
            lastCoupon = couponDate;
        }

        // Year fraction since last coupon
        const fraction = DayCountCalculator.yearFraction(
            lastCoupon,
            valuationDate,
            bond.dayCount
        );

        if (fraction <= 0) {
            return MajikMoney.fromMinor(0, bond.faceValue.currency.code);
        }

        // Gross accrued interest (major units)
        let accruedMajor = bond
            .faceValue
            .toMajorDecimal()
            .mul(bond.couponRate)
            .mul(fraction);

        // Apply withholding tax on interest if enabled
        if (bond.tax.enabled && bond.tax.interestFWT) {
            accruedMajor = accruedMajor.sub(
                accruedMajor.mul(bond.tax.interestFWT)
            );
        }

        // Round to nearest minor unit (banker's rounding)
        accruedMajor = accruedMajor.toDecimalPlaces(
            0,
            Decimal.ROUND_HALF_EVEN
        );

        return MajikMoney.fromMajor(
            accruedMajor,
            bond.faceValue.currency.code
        );
    }
}
