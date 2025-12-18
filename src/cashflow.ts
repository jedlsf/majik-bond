import Decimal from "decimal.js";
import { MajikMoney } from "@thezelijah/majik-money";
import { DayCountCalculator } from "./utils";
import { CashflowSummary } from "./types";
import type { MajikBond } from "./majik-bond";


/**
 * Generates bond cashflow tables.
 */
export class BondCashflow {

    /**
    * Generates a cashflow table.
    * @param bond The MajikBond instance
    */
    static generate(bond: MajikBond): CashflowSummary[] {
        const schedule: Date[] = [];
        const { maturity, frequency, faceValue, couponRate, dayCount, tax } = bond;

        const start = new Date(maturity.start);
        const end = new Date(maturity.end);
        const monthsPerPeriod = 12 / frequency;
        let current = new Date(start);

        while (current < end) {
            const next = new Date(current);
            next.setMonth(next.getMonth() + monthsPerPeriod);
            if (next.getDate() !== current.getDate()) next.setDate(0);
            schedule.push(next > end ? new Date(end) : new Date(next));
            current = next;
        }

        const rows: CashflowSummary[] = [];
        const faceMaj = faceValue.toMajorDecimal();
        const currencyCode = faceValue.currency.code;
        const issueDate = new Date(maturity.start);

        schedule.forEach((couponDate, idx) => {
            const prevDate = idx === 0 ? issueDate : schedule[idx - 1];
            const periodFraction = DayCountCalculator.yearFraction(prevDate, couponDate, dayCount);

            let interestMaj = faceMaj.mul(couponRate).mul(periodFraction);
            let taxMaj = new Decimal(0);
            if (tax.enabled && tax.interestFWT) {
                taxMaj = interestMaj.mul(tax.interestFWT);
                interestMaj = interestMaj.sub(taxMaj);
            }

            const principalMaj = idx === schedule.length - 1 ? faceMaj : new Decimal(0);

            rows.push({
                period: idx + 1,
                dateLabel: couponDate.toISOString().slice(0, 10),
                interest: MajikMoney.fromMajor(interestMaj.toDecimalPlaces(0), currencyCode),
                principal: MajikMoney.fromMajor(principalMaj.toDecimalPlaces(0), currencyCode),
                total: MajikMoney.fromMajor(interestMaj.add(principalMaj).toDecimalPlaces(0), currencyCode),
                tax: MajikMoney.fromMajor(taxMaj.toDecimalPlaces(0), currencyCode),
            });
        });

        return rows;
    }
}
