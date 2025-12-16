import {
    DayCountConvention
} from "./enums";
import { DayCountCalculator } from "./utils";



/**
 * ISO 8601 date string (UTC recommended).
 * Example: "2026-01-15T00:00:00.000Z"
 */
export type ISODateString = string;

/**
 * Explicit start and end date range.
 */
export interface DateRange {
    /** Start date (ISO 8601) */
    start: ISODateString;

    /** End date (ISO 8601) */
    end: ISODateString;
}

/**
 * Computed bond maturity metadata.
 */
export interface BondMaturity {
    /** Issue or start date */
    start: ISODateString;

    /** Maturity date */
    end: ISODateString;

    /** Total maturity length in years (fractional allowed) */
    years: number;

    issueDate?: ISODateString;

}

/**
 * Coupon payment frequency per year.
 * - 1  = Annual
 * - 2  = Semi-annual
 * - 4  = Quarterly
 * - 12 = Monthly
 */
export type CouponFrequency = 1 | 2 | 4 | 12;


/**
 * Initialization parameters for creating a bond instance.
 */
export interface BondParams {
    /**
     * Par value of the bond.
     * @default 1000
     */
    faceValue?: number;

    /**
     * Annual coupon rate as a decimal.
     * Example: 0.0625 = 6.25%
     * @default 0.05
     */
    couponRate?: number;

    /**
     * Bond maturity.
     * - number → years to maturity
     * - DateRange → explicit start/end dates
     * @default 5 years
     */
    maturity?: number | DateRange;

    /**
     * Bond buy and sell price expressed as a ratio of face value.
     * Example:
     * - 1.0 = par
     * - 0.95 = 95% of face value
     * @default 1.0
     */
    price?: {
        buy?: number;
        sell?: number;
    };

    /**
     * Coupon payment frequency per year.
     * @default 2 (semi-annual)
     */
    frequency?: CouponFrequency;

    /**
     * Market discount rate (used for pricing, duration, YTM initial guess).
     * @default couponRate
     */
    marketRate?: number;

    /**
    * Day count convention for interest accrual.
    * @default ACTUAL/365
    */
    dayCount?: DayCountConvention;

    tax?: BondTaxSettings;

}


/**
 * Single cashflow entry for a bond period.
 */
export interface CashflowSummary {
    /**
     * Sequential period index (1-based).
     */
    period: number;

    /**
     * Human-readable date label (YYYY-MM).
     */
    dateLabel: string;

    /**
     * Interest payment for the period.
     */
    interest: number;

    /**
     * Principal repayment (non-zero only at maturity).
     */
    principal: number;

    /**
     * Total cash received for the period.
     */
    total: number;

    tax: number;
}

/**
 * Optional tax settings for a bond.
 */
export interface BondTaxSettings {
    /** Master switch: if false, all taxes are ignored */
    enabled?: boolean;

    /** Final withholding tax on coupon interest (decimal, e.g., 0.2 = 20%) */
    interestFWT?: number;

    /** Capital gains tax rate when sold before maturity */
    capitalGains?: number;

    /** Estate or donor tax rate (informational only) */
    estateOrDonor?: number;


}



/**
 * General-purpose bond calculator supporting
 * government, corporate, and retail bonds.
 *
 * Designed for Philippine RTBs but works globally.
 */
export class MajikBond {

    faceValue: number;
    couponRate: number;
    maturity: BondMaturity;
    price: { buy: number; sell?: number };
    frequency: CouponFrequency;
    marketRate: number;
    dayCount: DayCountConvention;
    cashflowSummary: CashflowSummary[];
    tax: BondTaxSettings;

    private constructor(params: {
        faceValue: number;
        couponRate: number;
        maturity: BondMaturity;
        price: { buy: number; sell?: number };
        frequency: CouponFrequency;
        marketRate: number;
        dayCount: DayCountConvention;
        tax: BondTaxSettings;
    }) {
        this.faceValue = params.faceValue;
        this.couponRate = params.couponRate;
        this.maturity = params.maturity;
        this.price = params.price;
        this.frequency = params.frequency;
        this.marketRate = params.marketRate;
        this.dayCount = params.dayCount;
        this.cashflowSummary = []
        this.tax = params.tax;
    }


    /**
     * Create a fully initialized bond instance with sensible defaults.
     *
     * @param params Optional bond parameters
     * @returns Initialized MajikBond instance
     */
    static initialize(params: BondParams = {}): MajikBond {
        const now = new Date();

        let maturity: BondMaturity;

        if (typeof params.maturity === 'number') {
            const start = now.toISOString();
            const endDate = new Date(now);
            endDate.setFullYear(endDate.getFullYear() + params.maturity);

            maturity = {
                start,
                end: endDate.toISOString(),
                years: params.maturity,
            };
        } else if (params.maturity) {
            const startDate = new Date(params.maturity.start);
            const endDate = new Date(params.maturity.end);
            const years = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

            maturity = {
                start: params.maturity.start,
                end: params.maturity.end,
                years,
            };
        } else {
            const endDate = new Date(now);
            endDate.setFullYear(endDate.getFullYear() + 5);

            maturity = {
                start: now.toISOString(),
                end: endDate.toISOString(),
                years: 5,
            };
        }

        const newInstance = new MajikBond({
            faceValue: params.faceValue ?? 5000,
            couponRate: params.couponRate ?? 0.05,
            maturity,
            price: {
                buy: params.price?.buy || 1,
                sell: params.price?.sell || 1,
            },
            frequency: params.frequency ?? 2,
            marketRate: params.marketRate ?? params.couponRate ?? 0.05,
            dayCount: params.dayCount ?? DayCountConvention.ACTUAL_365,
            tax: {
                enabled: params.tax?.enabled ?? false,
                interestFWT: params.tax?.interestFWT ?? 0.2,
                capitalGains: params.tax?.capitalGains ?? 0.15,
                estateOrDonor: params.tax?.estateOrDonor ?? 0,
            }
        });
        newInstance.computeCashflowSummary();

        console.log(newInstance);

        return newInstance;
    }

    // --- Core values ---

    /**
     * Coupon payment amount per period.
     */
    get couponPerPeriod(): number {
        return (this.faceValue * this.couponRate) / this.frequency;
    }

    /**
     * Total number of coupon periods over bond lifetime.
     */
    get totalPeriods(): number {
        return Math.floor(this.maturity.years * this.frequency);
    }

    /**
     * Coupon rate.
     */
    get interest(): number {
        if (this.couponRate < 0) {
            throw new Error("Coupon rate cannot be negative");
        }

        return this.couponRate;
    }


    // --- Yield Metrics ---

    /**
     * Current Yield.
     *
     * Formula:
     * `Annual Coupon` / `Current Market Price`
     */
    getCurrentYield(): number {
        return (this.faceValue * this.couponRate) / (this.price.buy * this.faceValue);
    }

    /**
     * Yield to Maturity (YTM).
     *
     * Solved numerically using Newton–Raphson iteration.
     *
     * @param iterations Maximum iterations
     * @param tolerance Convergence threshold
     */
    getYTM(iterations = 100, tolerance = 1e-6): number {
        let ytm = this.marketRate;

        for (let i = 0; i < iterations; i++) {
            let f = 0;
            let df = 0;

            for (let t = 1; t <= this.totalPeriods; t++) {
                const discount = Math.pow(1 + ytm / this.frequency, t);
                f += this.couponPerPeriod / discount;
                df -= (t * this.couponPerPeriod) /
                    (this.frequency * discount * (1 + ytm / this.frequency));
            }

            const finalDiscount = Math.pow(1 + ytm / this.frequency, this.totalPeriods);
            f += this.faceValue / finalDiscount - this.price.buy * this.faceValue;
            df -= (this.totalPeriods * this.faceValue) /
                (this.frequency * finalDiscount * (1 + ytm / this.frequency));

            const next = ytm - f / df;
            if (!isFinite(next) || Math.abs(df) < 1e-10) break;
            if (Math.abs(next - ytm) < tolerance) break;
            ytm = next;

        }

        return ytm;
    }

    // --- Pricing ---

    /**
     * Computes bond price given a discount rate.
     *
     * @param rate Market discount rate
     * @returns Price as a ratio of face value
     */
    getBondPrice(rate = this.marketRate): number {
        let price = 0;

        for (let t = 1; t <= this.totalPeriods; t++) {
            price += this.couponPerPeriod / Math.pow(1 + rate / this.frequency, t);
        }

        price += this.faceValue / Math.pow(1 + rate / this.frequency, this.totalPeriods);
        return price / this.faceValue;
    }

    // --- Interest Rate Sensitivity ---

    /**
     * Macaulay Duration (in years).
     */
    getDuration(): number {
        let weightedSum = 0;
        let pvTotal = 0;

        for (let t = 1; t <= this.totalPeriods; t++) {
            const pv = this.couponPerPeriod / Math.pow(1 + this.marketRate / this.frequency, t);
            weightedSum += t * pv;
            pvTotal += pv;
        }

        const pvFace = this.faceValue / Math.pow(1 + this.marketRate / this.frequency, this.totalPeriods);
        weightedSum += this.totalPeriods * pvFace;
        pvTotal += pvFace;

        return (weightedSum / pvTotal) / this.frequency;
    }

    /**
     * Modified Duration.
     * Measures price sensitivity to interest rate changes.
     */
    getModifiedDuration(): number {
        return this.getDuration() / (1 + this.marketRate / this.frequency);
    }

    // --- Cashflow Tables ---

    /**
     * Generates a cashflow table.
     *
     * @param monthly Expand coupons into monthly equivalents
     */
    getCashflowSummary(monthly: boolean = false): CashflowSummary[] {
        this.computeCashflowSummary(monthly);

        return this.cashflowSummary;
    }

    /**
     * Recomputes and stores the internal cashflow summary.
     *
     * @param monthly Expand coupons into monthly equivalents
     */
    computeCashflowSummary(monthly: boolean = false): void {
        const rows: CashflowSummary[] = [];
        const startDate = new Date(this.maturity.start);
        const monthsPerPeriod = 12 / this.frequency;

        for (let p = 1; p <= this.totalPeriods; p++) {
            const periodStart = new Date(startDate);
            periodStart.setMonth(periodStart.getMonth() + (p - 1) * monthsPerPeriod);

            const periodEnd = new Date(startDate);
            periodEnd.setMonth(periodEnd.getMonth() + p * monthsPerPeriod);

            let interest = this.faceValue * this.couponRate *
                DayCountCalculator.yearFraction(periodStart, periodEnd, this.dayCount);

            let taxAmount = 0;
            if (this.tax.enabled && this.tax.interestFWT) {
                taxAmount = interest * this.tax.interestFWT;
                interest -= taxAmount;
            }

            const principal = p === this.totalPeriods ? this.faceValue : 0;

            if (monthly && this.frequency !== 12) {
                const months = 12 / this.frequency;
                for (let m = 1; m <= months; m++) {
                    const labelDate = new Date(startDate);
                    labelDate.setMonth(labelDate.getMonth() + (p - 1) * months + (m - 1));

                    const monthlyInterest = interest / months;
                    const monthlyTax = taxAmount / months;

                    rows.push({
                        period: (p - 1) * months + m,
                        dateLabel: labelDate.toISOString().slice(0, 7),
                        interest: monthlyInterest,
                        principal: m === months ? principal : 0,
                        total: monthlyInterest + (m === months ? principal : 0),
                        tax: monthlyTax,
                    });
                }
            } else {
                const labelDate = new Date(startDate);
                labelDate.setMonth(labelDate.getMonth() + (12 / this.frequency) * (p - 1));

                rows.push({
                    period: p,
                    dateLabel: labelDate.toISOString().slice(0, 7),
                    interest,
                    principal,
                    total: interest + principal,
                    tax: taxAmount,
                });
            }
        }

        this.cashflowSummary = rows;
    }


    // --- Investment Planning ---

    /**
     * Calculates required investment to achieve a target monthly income.
     *
     * @param targetMonthly Desired monthly cash income
     * @returns Required investment amount
     */
    getRequiredInvestmentForMonthlyIncome(targetMonthly: number): number {
        const annualIncomePerBond = this.faceValue * this.couponRate;
        const monthlyIncomePerBond = annualIncomePerBond / 12;

        const bondsNeeded = targetMonthly / monthlyIncomePerBond;
        return bondsNeeded * this.faceValue * this.price.buy;
    }


    getCouponPerPeriod(): number {
        let coupon = (this.faceValue * this.couponRate) / this.frequency;
        if (this.tax.enabled && this.tax.interestFWT) {
            coupon *= (1 - this.tax.interestFWT);
        }
        return coupon;
    }


    /**
     * Total cash received over the bond lifetime.
     */
    getTotalCashReceived(): number {
        return this.cashflowSummary.reduce((sum, cf) => sum + cf.total, 0);
    }


    /**
     * Total interest earned over the bond lifetime.
     */
    getTotalInterestEarned(): number {
        const total = this.cashflowSummary.reduce((sum, cf) => sum + cf.interest, 0);
        return total;
    }


    /**
     * Net gain (cash received minus initial investment).
     */
    get netGain(): number {
        const invested = this.faceValue * this.price.buy;
        return this.getTotalCashReceived() - invested;
    }


    /**
     * Total return as a percentage of invested capital.
     */
    get totalReturn(): number {
        const invested = this.faceValue * this.price.buy;
        return this.netGain / invested;
    }


    // --- Net gain if sold early ---
    getNetGainOnSale(): number {
        if (this.price.sell == null) throw new Error("Sell price not set");

        const invested = this.faceValue * this.price.buy; // initial investment
        const totalInterest = this.getTotalInterestEarned(); // tax-adjusted interest

        // Compute capital gain
        let capitalGain = this.faceValue * (this.price.sell - this.price.buy);
        if (this.tax.enabled && this.tax.capitalGains) {
            capitalGain *= (1 - this.tax.capitalGains);
        }

        // Net gain = total received (interest + capital gain) - initial investment
        return totalInterest + capitalGain - invested;
    }



    getTotalReturnOnSale(): number {
        const invested = this.faceValue * this.price.buy;
        return this.getNetGainOnSale() / invested;
    }

    // --- Setter methods (chainable) ---

    /**
    * Set the day count convention for interest accrual.
    *
    * @param convention DayCountConvention enum value
    * @returns `this` for chaining
    */
    setDayCount(convention: DayCountConvention): this {
        this.dayCount = convention;
        this.computeCashflowSummary();
        return this;
    }



    setFaceValue(value: number): this {
        if (value <= 0) throw new Error("Face value must be positive");
        this.faceValue = value;
        this.computeCashflowSummary();
        return this;
    }


    setCouponRate(rate: number): this {
        if (rate < 0) throw new Error("Coupon rate cannot be negative");
        this.couponRate = rate;
        this.computeCashflowSummary();
        return this;
    }




    setBuyPrice(price: number): this {
        if (price <= 0) throw new Error("Buy price must be positive");
        this.price.buy = price;
        this.computeCashflowSummary();
        return this;
    }

    setSellPrice(price: number): this {
        if (price <= 0) throw new Error("Sell price must be positive");
        this.price.sell = price;
        return this;
    }


    setFrequency(freq: CouponFrequency): this {
        this.frequency = freq;
        this.computeCashflowSummary();
        return this;
    }


    setMarketRate(rate: number): this {
        if (rate < 0) throw new Error("Market rate cannot be negative");
        this.marketRate = rate;
        this.computeCashflowSummary();
        return this;
    }




    setMaturity(maturity: number | DateRange): this {
        const now = new Date();


        if (typeof maturity === 'number') {
            const start = now.toISOString();
            const endDate = new Date(now);
            endDate.setFullYear(endDate.getFullYear() + maturity);


            this.maturity = {
                start,
                end: endDate.toISOString(),
                years: maturity,
            };
        } else {
            const startDate = new Date(maturity.start);
            const endDate = new Date(maturity.end);
            const years = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);


            this.maturity = {
                start: maturity.start,
                end: maturity.end,
                years,
            };
        }
        this.computeCashflowSummary();


        return this;
    }


    /**
    * Set bond issue date (start date).
    * Automatically recomputes maturity years.
    */
    setIssueDate(date: ISODateString): this {
        this.maturity.start = date;
        this.maturity.issueDate = date;

        // default end if missing (safety)
        if (!this.maturity.end) {
            const end = new Date(date);
            end.setFullYear(end.getFullYear() + 1);
            this.maturity.end = end.toISOString();
        }

        this.recomputeMaturityYears();
        this.computeCashflowSummary();
        return this;
    }

    /**
     * Set bond maturity date (end date).
     * Automatically recomputes maturity years.
     */
    setMaturityDate(date: ISODateString): this {
        this.maturity.end = date;

        // default start if missing (safety)
        if (!this.maturity.start) {
            this.maturity.start = new Date().toISOString();
        }

        this.recomputeMaturityYears();
        this.computeCashflowSummary();
        return this;
    }


    /**
    * Toggles the tax.
    * @param bool - Toggles the current value if unset.
    */
    toggleTax(bool?: boolean): this {

        this.tax.enabled = bool ?? !this.tax.enabled;
        this.computeCashflowSummary();

        return this;
    }

    setInterestFWT(rate: number): this {
        if (rate < 0 || rate > 1) throw new Error("Interest FWT must be between 0 and 1");
        this.tax.interestFWT = rate;
        this.computeCashflowSummary(); // recalc cashflows if enabled
        return this;
    }

    setCapitalGains(rate: number): this {
        if (rate < 0 || rate > 1) throw new Error("Capital gains tax must be between 0 and 1");
        this.tax.capitalGains = rate;
        return this;
    }

    setEstateOrDonor(rate: number): this {
        if (rate < 0 || rate > 1) throw new Error("Estate/Donor tax must be between 0 and 1");
        this.tax.estateOrDonor = rate;
        return this;
    }

    /**
    * Total tax paid over the bond lifetime (all periods).
    */
    getTotalTax(): number {
        return this.cashflowSummary.reduce((sum, cf) => sum + cf.tax, 0);
    }

    /**
     * Total tax paid on interest only (for clarity, same as above if FWT only).
     */
    getTotalInterestTax(): number {
        return this.cashflowSummary.reduce((sum, cf) => sum + cf.tax, 0);
    }


    /**
     * Capital gains tax if sold at the current sell price.
     */
    getCapitalGainsTax(): number {
        if (!this.price.sell) throw new Error("Sell price not set");
        if (!this.tax.enabled || !this.tax.capitalGains) return 0;

        const capitalGain = this.faceValue * (this.price.sell - this.price.buy);
        return capitalGain * this.tax.capitalGains;
    }


    private recomputeMaturityYears(): void {
        const start = new Date(this.maturity.start);
        const end = new Date(this.maturity.end);

        if (end <= start) {
            throw new Error("Maturity date must be after issue date");
        }

        this.maturity.years =
            (end.getTime() - start.getTime()) /
            (1000 * 60 * 60 * 24 * 365.25);
    }


    /**
        * Generates a new instance from a JSON string or object.
        * Validates required properties.
        *
        * @param json - JSON string or object
        * @returns {MajikBond} A new instance
        * @throws {Error} Missing required properties
        */
    static parseFromJSON(json: string | object): MajikBond {
        const parsed: MajikBond =
            typeof json === "string"
                ? JSON.parse(json)
                : structuredClone
                    ? structuredClone(json)
                    : JSON.parse(JSON.stringify(json));
        return new MajikBond(
            {
                couponRate: parsed.couponRate,
                dayCount: parsed.dayCount,
                faceValue: parsed.faceValue,
                frequency: parsed.frequency,
                marketRate: parsed.marketRate,
                maturity: parsed.maturity,
                price: parsed.price,
                tax: parsed.tax
            }
        );
    }

    /**
    * Converts the current instance to a plain JSON object.
    * @returns {object} Plain object representation.
    */
    toJSON(): object {
        return {
            faceValue: this.faceValue,
            couponRate: this.couponRate,
            maturity: this.maturity,
            price: this.price,
            frequency: this.frequency,
            marketRate: this.marketRate,
            dayCount: this.dayCount,
            cashflowSummary: this.cashflowSummary,
            tax: this.tax

        };
    }

}

