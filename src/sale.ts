import { PriceMode } from "./enums";
import { MajikBond } from "./majik-bond";
import { BondPricing } from "./pricing";
import { BondSaleSummary } from "./types";
import { MajikMoney } from "@thezelijah/majik-money";

/**
 * BondSale
 *
 * Stateless sale & exit scenario engine for bonds.
 * All methods are pure and MUST NOT mutate the bond.
 */
export class BondSale {

    /**
     * Returns the effective sell price ratio for a given date.
     * Prefers manual sell price if set, otherwise uses market-based dirty price.
     */
    static getSellPriceRatio(
        bond: MajikBond,
        asOfDate: string = new Date().toISOString()
    ): number {
        if (bond.price.sell != null) {
            return bond.price.sell;
        }

        // Market exit assumes dirty price (includes accrued interest)
        return BondPricing.computePrice(
            bond,
            bond.marketRate,
            asOfDate,
            PriceMode.Dirty
        );
    }

    /**
     * Computes capital gains tax on sale.
     * Capital Gain = (Sell Price - Buy Price) * Face Value
     */
    static computeCapitalGainsTax(
        bond: MajikBond,
        asOfDate: string = new Date().toISOString()
    ): MajikMoney {

        if (!bond.tax.enabled || !bond.tax.capitalGains) {
            return MajikMoney.fromMinor(0, bond.faceValue.currency.code);
        }

        const sellRatio = this.getSellPriceRatio(bond, asOfDate);
        const gainRatio = sellRatio - bond.price.buy;

        if (gainRatio <= 0) {
            return MajikMoney.fromMinor(0, bond.faceValue.currency.code);
        }

        return bond.faceValue
            .multiply(gainRatio)
            .multiply(bond.tax.capitalGains);
    }

    /**
     * Computes net gain if bond is sold on a given date.
     * Includes:
     * - Sale proceeds
     * - Accrued interest
     * - Capital gains tax
     * - Initial investment
     */
    static computeNetGain(
        bond: MajikBond,
        asOfDate: string = new Date().toISOString()
    ): MajikMoney {

        const sellRatio = this.getSellPriceRatio(bond, asOfDate);
        const saleProceeds = bond.faceValue.multiply(sellRatio);
        const accruedInterest = bond.getAccruedInterest(asOfDate);
        const invested = bond.faceValue.multiply(bond.price.buy);

        const capitalGainsTax = this.computeCapitalGainsTax(bond, asOfDate);

        return saleProceeds
            .add(accruedInterest)
            .subtract(invested)
            .subtract(capitalGainsTax);
    }

    /**
     * Computes total return ratio if sold at a given date.
     */
    static computeTotalReturnRatio(
        bond: MajikBond,
        asOfDate: string = new Date().toISOString()
    ): number {
        const invested = bond.faceValue.multiply(bond.price.buy);
        return this.computeNetGain(bond, asOfDate).ratio(invested);
    }

    /**
     * Runs a full sale simulation and returns a detailed summary.
     */
    static simulate(
        bond: MajikBond,
        asOfDate: string = new Date().toISOString()
    ): BondSaleSummary {

        const cleanPriceRatio = BondPricing.computePrice(
            bond,
            bond.marketRate,
            asOfDate,
            PriceMode.Clean
        );

        const dirtyPriceRatio = BondPricing.computePrice(
            bond,
            bond.marketRate,
            asOfDate,
            PriceMode.Dirty
        );

        const accruedInterest = bond.getAccruedInterest(asOfDate);
        const sellPriceUsed = this.getSellPriceRatio(bond, asOfDate);
        const capitalGainsTax = this.computeCapitalGainsTax(bond, asOfDate);
        const netGain = this.computeNetGain(bond, asOfDate);

        return {
            asOfDate,
            cleanPrice: bond.faceValue.multiply(cleanPriceRatio),
            dirtyPrice: bond.faceValue.multiply(dirtyPriceRatio),
            accruedInterest,
            capitalGainsTax,
            netGain,
            sellPriceUsed,
        };
    }
}
