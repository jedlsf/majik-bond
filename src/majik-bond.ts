import Decimal from "decimal.js";
import { CURRENCIES } from "@thezelijah/majik-money";
import { deserializeMoney, MajikMoney, serializeMoney } from "@thezelijah/majik-money";
import {
    DayCountConvention,
    PriceMode
} from "./enums";
import {
    BondMaturity,
    BondParams,
    BondSaleSummary,
    BondTaxSettings,
    CashflowSummary,
    CouponFrequency,
    DateRange,
    ISODateString,
    YTMCurvePlot
} from "./types";
import { DayCountCalculator } from "./utils";
import { BondCashflow } from "./cashflow";
import { BondPricing } from "./pricing";
import { BondSale } from "./sale";
import { BondAccrual } from "./accrual";
import { BondTax } from "./tax";


/**
 * Configure Decimal for consistent behaviour across the library.
 * - precision high enough for financial calculations
 * - rounding uses ROUND_HALF_EVEN (bankers rounding)
 */
Decimal.set({
    precision: 40,
    rounding: Decimal.ROUND_HALF_EVEN,
    toExpNeg: -20,
    toExpPos: 50,
});



/**
 * General-purpose bond calculator supporting
 * government, corporate, and retail bonds.
 *
 * Designed for Philippine RTBs but works globally.
 */
export class MajikBond {

    faceValue: MajikMoney;
    couponRate: number;
    maturity: BondMaturity;
    price: { buy: number; sell: number | null };
    frequency: CouponFrequency;
    marketRate: number;
    dayCount: DayCountConvention;
    cashflowSummary: CashflowSummary[];
    tax: BondTaxSettings;
    private taxEngine?: BondTax;
    private ytm_curve?: YTMCurvePlot[];
    priceMode: PriceMode = PriceMode.Clean;




    private constructor(params: {
        faceValue: MajikMoney;
        currencyCode: string;
        couponRate: number;
        maturity: BondMaturity;
        price: { buy: number; sell: number | null };
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

    private get DEFAULT_ZERO(): MajikMoney {
        return MajikMoney.fromMinor(0, this.faceValue.currency.code);
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
            faceValue: params.faceValue ?? new MajikMoney(5000, CURRENCIES[params?.currencyCode || "PHP"]),
            currencyCode: params.currencyCode || "PHP",
            couponRate: params.couponRate ?? 0.05,
            maturity,
            price: {
                buy: params.price?.buy || 1,
                sell: params.price?.sell || null,
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
        newInstance.recomputeDerivedData();
        newInstance.computeMarketRate();
        newInstance.initTaxEngine();

        return newInstance;
    }

    private initTaxEngine() {
        this.taxEngine = new BondTax(this, this.tax);
    }

    getTaxEngine(): BondTax {
        if (!this.taxEngine) this.initTaxEngine();
        return this.taxEngine!;
    }


    // --- Core values ---

    /**
     * Coupon payment amount per period.
     */
    get couponPerPeriod(): MajikMoney {
        return this.faceValue.multiply(this.couponRate).divide(this.frequency);
    }

    /**
     * Total number of coupon periods over bond lifetime.
     */
    get totalPeriods(): number {
        const start = new Date(this.maturity.start);
        const end = new Date(this.maturity.end);

        const years = DayCountCalculator.yearFraction(start, end, this.dayCount);


        return Math.round(years * this.frequency);
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
        const annualCoupon = this.faceValue.multiply(this.couponRate);
        const marketPrice = this.faceValue.multiply(this.price.buy);
        return annualCoupon.ratio(marketPrice);
    }




    /**
     * Yield to Maturity (YTM).
     *
     * Solved numerically using Newton–Raphson iteration.
     *
     * @param iterations Maximum iterations
     * @param tolerance Convergence threshold
     */
    getYTM(iterations = 100, tolerance = 1e-12): number {
        return BondPricing.solveYTMFromPrice(this, undefined, undefined, iterations, tolerance);
    }




    // --- Pricing ---

    /**
     * Set global price mode: clean or dirty.
     */
    setPriceMode(mode: PriceMode): this {
        this.priceMode = mode;
        this.recomputeDerivedData();
        return this;
    }

    /**
    * Convenience methods
    */
    useCleanPrice(): this { return this.setPriceMode(PriceMode.Clean); }
    useDirtyPrice(): this { return this.setPriceMode(PriceMode.Dirty); }

    /**
     * Computes bond price given a discount rate.
     *
     * @param rate Market discount rate
     * @returns Price as a ratio of face value
     */
    getBondPrice(rate = this.marketRate, asOfDate: string = new Date().toISOString()): number {
        return BondPricing.computePrice(this, rate, asOfDate, this.priceMode);
    }



    /**
     * Automatically computes the market rate for the bond (YTM).
     * Uses the current buy price (clean or dirty) without mutating state.
     */
    computeMarketRate(): void {
        this.marketRate = BondPricing.computeMarketRate(this);
    }





    // --- Interest Rate Sensitivity ---

    /**
     * Macaulay Duration (clean-price basis).
     * Accrued interest is excluded by design.
     */
    getDuration(): number {
        return BondPricing.getDuration(this);
    }


    /**
     * Modified Duration.
     * Measures price sensitivity to interest rate changes.
     */
    getModifiedDuration(): number {
        return BondPricing.getModifiedDuration(this);
    }


    // --- Cashflow Tables ---

    /**
     * Generates a cashflow table.
     *
     */
    getCashflowSummary(): CashflowSummary[] {
        this.computeCashflowSummary();

        return this.cashflowSummary;
    }

    /**
  * Recomputes the bond's cashflow summary with accurate first/last period calculations.
  */
    computeCashflowSummary(): void {
        this.cashflowSummary = BondCashflow.generate(this);
    }



    // --- Investment Planning ---

    /**
     * Calculates required investment to achieve a target monthly income.
     *
     * @param targetMonthly Desired monthly cash income
     * @returns Required investment amount
     */
    getRequiredInvestmentForMonthlyIncome(targetMonthly: number): number {
        return BondPricing.getRequiredInvestmentForMonthlyIncome(this, targetMonthly);
    }


    /**
     * Total cash received over the bond lifetime.
     */
    getTotalCashReceived(): MajikMoney {
        return this.cashflowSummary.reduce((sum, cf) => sum.add(cf.total), this.DEFAULT_ZERO);
    }


    /**
     * Total interest earned over the bond lifetime.
     */
    getTotalInterestEarned(): MajikMoney {
        const total = this.cashflowSummary.reduce((sum, cf) => sum.add(cf.interest), this.DEFAULT_ZERO);
        return total;
    }


    /**
     * Net gain (cash received minus initial investment).
     */
    get netGain(): MajikMoney {
        const invested = this.faceValue.multiply(this.price.buy);
        return this.getTotalCashReceived().subtract(invested);
    }


    /**
     * Total return as a percentage of invested capital.
     */
    get totalReturn(): number {
        const invested = this.faceValue.multiply(this.price.buy);
        return this.netGain.ratio(invested);
    }

    // --- Sell / Sale Methods ---

    /**
     * Returns the effective sell price to use for a given date.
     * Prefers manual sell price if set, otherwise uses market-based dirty price.
     */
    getSellPrice(asOfDate: string = new Date().toISOString()): number {
        return BondSale.getSellPriceRatio(this, asOfDate);
    }

    /**
     * Capital gains tax if sold at the current sell price.
     */
    getCapitalGainsTax(asOfDate: string = new Date().toISOString()): MajikMoney {
        if (!this.tax.enabled || !this.tax.capitalGains) return this.DEFAULT_ZERO;
        return BondSale.computeCapitalGainsTax(this, asOfDate);
    }

    /**
     * Net gain if sold at a specific date.
     * Accounts for capital gains, accrued interest, and initial investment.
     */
    getNetGainOnSale(asOfDate: string = new Date().toISOString()): MajikMoney {
        return BondSale.computeNetGain(this, asOfDate);
    }

    /**
     * Total return as a ratio if sold at a specific date.
     */
    getTotalReturnOnSale(asOfDate: string = new Date().toISOString()): number {
        return BondSale.computeTotalReturnRatio(this, asOfDate);
    }


    /**
     * Simulate a sale at a given date and return detailed summary.
     */
    simulateSale(asOfDate: string = new Date().toISOString()): BondSaleSummary {
        return BondSale.simulate(this, asOfDate);
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
        this.recomputeDerivedData();
        return this;
    }



    setFaceValue(value: number, currencyCode: string = "PHP"): this {
        if (value <= 0) throw new Error("Face value must be positive");
        this.faceValue = MajikMoney.fromMajor(value, currencyCode);
        this.recomputeDerivedData();
        return this;
    }

    setCurrencyCode(currencyCode: string): this {
        if (!currencyCode?.trim()) {
            throw new Error("Invalid currency code");
        }

        const currency = CURRENCIES[currencyCode];
        if (!currency) {
            throw new Error(`Unsupported currency: ${currencyCode}`);
        }
        this.faceValue = MajikMoney.fromMinor(this.faceValue.toMinor(), currencyCode);
        this.recomputeDerivedData();
        return this;
    }



    setCouponRate(rate: number): this {
        if (rate < 0) throw new Error("Coupon rate cannot be negative");
        this.couponRate = rate;
        this.recomputeDerivedData();
        return this;
    }




    setBuyPrice(price: number): this {
        if (price <= 0) throw new Error("Buy price must be positive");
        this.price.buy = price;
        this.recomputeDerivedData();
        return this;
    }

    setSellPrice(price: number): this {
        if (price <= 0) throw new Error("Sell price must be positive");
        this.price.sell = price;
        this.recomputeDerivedData();
        return this;
    }


    setFrequency(freq: CouponFrequency): this {
        this.frequency = freq;
        this.recomputeDerivedData();
        return this;
    }


    setMarketRate(rate: number): this {
        if (rate < 0) throw new Error("Market rate cannot be negative");
        this.marketRate = rate;
        this.recomputeDerivedData();
        BondPricing.computeYTMCurve(this);
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
        this.recomputeDerivedData();
        BondPricing.computeYTMCurve(this);


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
        this.recomputeDerivedData();
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
        this.recomputeDerivedData();
        BondPricing.computeYTMCurve(this);
        return this;
    }


    /**
    * Toggles the tax.
    * @param bool - Toggles the current value if unset.
    */
    toggleTax(bool?: boolean): this {

        this.tax.enabled = bool ?? !this.tax.enabled;
        this.recomputeDerivedData();
        this.initTaxEngine();
        return this;
    }

    setInterestFWT(rate: number): this {
        if (rate < 0 || rate > 1) throw new Error("Interest FWT must be between 0 and 1");
        this.tax.interestFWT = rate;
        this.recomputeDerivedData();
        this.initTaxEngine();
        return this;
    }

    setCapitalGains(rate: number): this {
        if (rate < 0 || rate > 1) throw new Error("Capital gains tax must be between 0 and 1");
        this.tax.capitalGains = rate;
        this.recomputeDerivedData();
        this.initTaxEngine();
        return this;
    }

    setEstateOrDonor(rate: number): this {
        if (rate < 0 || rate > 1) throw new Error("Estate/Donor tax must be between 0 and 1");
        this.tax.estateOrDonor = rate;
        this.recomputeDerivedData();
        this.initTaxEngine();
        return this;
    }

    /**
    * Total tax paid over the bond lifetime (all periods).
    */
    getTotalTax(includeEstate: boolean = false): MajikMoney {
        return this.taxEngine?.totalTax(includeEstate) ?? this.DEFAULT_ZERO;
    }

    /**
     * Total tax paid on interest only (for clarity, same as above if FWT only).
     */
    getTotalInterestTax(): MajikMoney {
        return this.taxEngine?.totalInterestTax() ?? this.DEFAULT_ZERO;
    }




    private recomputeMaturityYears(): void {
        const start = new Date(this.maturity.start);
        const end = new Date(this.maturity.end);

        if (end <= start) {
            throw new Error("Maturity date must be after issue date");
        }

        this.maturity.years = DayCountCalculator.yearFraction(start, end, this.dayCount);

    }



    /**
     * Generates a Plotly-ready YTM curve.
     *
     * @param options Optional curve configuration
     */
    get YTMCurve(): YTMCurvePlot[] {
        if (!this.ytm_curve) {
            this.ytm_curve = BondPricing.computeYTMCurve(this);
        }
        return this.ytm_curve;
    }



    private recomputeDerivedData(): void {
        this.computeCashflowSummary();
    }

    /**
     * Generates the coupon payment schedule.
     * Handles fractional periods and end-of-month issues.
     */
    generateCouponSchedule(): Date[] {
        const schedule: Date[] = [];
        const start = new Date(this.maturity.start);
        const end = new Date(this.maturity.end);
        const monthsPerPeriod = 12 / this.frequency;

        let current = new Date(start);

        while (current < end) {
            const next = new Date(current);
            next.setMonth(next.getMonth() + monthsPerPeriod);

            // Adjust end-of-month if month rolled over
            if (next.getDate() !== current.getDate()) {
                next.setDate(0); // last day of previous month
            }

            // Push either next or maturity end date if last period
            if (next > end) {
                schedule.push(new Date(end));
            } else {
                schedule.push(new Date(next));
            }

            current = next;
        }

        return schedule;
    }


    getAccruedInterest(asOfDate: string = new Date().toISOString()): MajikMoney {
        return BondAccrual.accruedInterest(this, asOfDate);
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
        const rawParse: MajikBond =
            typeof json === "string"
                ? JSON.parse(json)
                : structuredClone
                    ? structuredClone(json)
                    : JSON.parse(JSON.stringify(json));

        const parsed: MajikBond = deserializeMoney(rawParse);

        const parsedInstance = MajikBond.initialize(
            {
                couponRate: parsed.couponRate,
                dayCount: parsed.dayCount,
                faceValue: parsed.faceValue,
                currencyCode: parsed.faceValue.currency.code,
                frequency: parsed.frequency,
                marketRate: parsed.marketRate,
                maturity: parsed.maturity,
                price: parsed.price,
                tax: parsed.tax
            }
        );
        return parsedInstance;
    }

    /**
    * Converts the current instance to a plain JSON object.
    * @returns {object} Plain object representation.
    */
    toJSON(): object {

        const preJSON = {
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

        const serializedMoney = serializeMoney(preJSON);

        return serializedMoney;
    }

}

