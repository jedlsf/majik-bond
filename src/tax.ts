// BondTax.ts
import { MajikMoney } from "@thezelijah/majik-money";
import { MajikBond } from "./majik-bond";
import { BondTaxSettings } from "./types";


/**
 * BondTax is responsible for calculating all tax obligations
 * for a given bond: interest FWT, capital gains, estate/donor.
 */
export class BondTax {
    bond: MajikBond;
    settings: BondTaxSettings;

    constructor(bond: MajikBond, settings: BondTaxSettings) {
        this.bond = bond;
        this.settings = settings;
    }

    /**
     * Calculates withholding tax on accrued interest for a given period.
     */
    computeInterestFWT(interestAmount: MajikMoney): MajikMoney {
        if (!this.settings.enabled || !this.settings.interestFWT) return MajikMoney.fromMinor(0, interestAmount.currency.code);

        const taxAmount = interestAmount.multiply(this.settings.interestFWT);
        return taxAmount;
    }

    /**
     * Computes capital gains tax for a sale at a given sell price.
     */
    computeCapitalGains(sellPrice: MajikMoney, costBasis: MajikMoney): MajikMoney {
        if (!this.settings.enabled || !this.settings.capitalGains) return MajikMoney.fromMinor(0, sellPrice.currency.code);

        const gain = sellPrice.subtract(costBasis);
        if (gain.toMinor() <= 0) return MajikMoney.fromMinor(0, sellPrice.currency.code);

        const taxAmount = gain.multiply(this.settings.capitalGains);
        return taxAmount;
    }

    /**
     * Computes estate or donor tax on the bond's face value.
     */
    computeEstateOrDonor(): MajikMoney {
        if (!this.settings.enabled || !this.settings.estateOrDonor) return MajikMoney.fromMinor(0, this.bond.faceValue.currency.code);

        return this.bond.faceValue.multiply(this.settings.estateOrDonor);
    }

    /**
     * Total tax paid on interest across the bond's lifetime.
     */
    totalInterestTax(): MajikMoney {
        return this.bond.getCashflowSummary().reduce((sum, cf) => {
            const fwt = this.computeInterestFWT(cf.interest);
            return sum.add(fwt);
        }, MajikMoney.fromMinor(0, this.bond.faceValue.currency.code));
    }

    /**
     * Total tax paid over the bond's lifetime (interest + capital gains if applicable).
     * Optionally includes estate/donor.
     */
    totalTax(includeEstate: boolean = false): MajikMoney {
        const interestTax = this.totalInterestTax();
        let capitalGainsTax = MajikMoney.fromMinor(0, this.bond.faceValue.currency.code);
        let estateTax = MajikMoney.fromMinor(0, this.bond.faceValue.currency.code);

        if (this.settings.capitalGains && this.bond.price.sell) {
            const sellPrice = this.bond.faceValue.multiply(this.bond.price.sell);
            const costBasis = this.bond.faceValue.multiply(this.bond.price.buy);
            capitalGainsTax = this.computeCapitalGains(sellPrice, costBasis);
        }

        if (includeEstate && this.settings.estateOrDonor) {
            estateTax = this.computeEstateOrDonor();
        }

        return interestTax.add(capitalGainsTax).add(estateTax);
    }

    /**
     * Computes net gain after all taxes for a given sale price.
     */
    netGainAfterTax(sellPrice: MajikMoney): MajikMoney {
        const invested = this.bond.faceValue.multiply(this.bond.price.buy);
        const gain = sellPrice.subtract(invested);

        const capitalGainsTax = this.computeCapitalGains(sellPrice, invested);
        const interestTax = this.totalInterestTax();

        return gain.subtract(capitalGainsTax).subtract(interestTax);
    }
}
