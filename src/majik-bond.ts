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
    price: { buy: number; sell: number | null };
    frequency: CouponFrequency;
    marketRate: number;
    dayCount: DayCountConvention;
    cashflowSummary: CashflowSummary[];
    tax: BondTaxSettings;
    private ytm_curve?: YTMCurvePlot[];
    priceMode: PriceMode = PriceMode.Clean;

    private constructor(params: {
        faceValue: number;
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
        const start = new Date(this.maturity.start);
        const end = new Date(this.maturity.end);

        const years =
            (end.getTime() - start.getTime()) /
            (1000 * 60 * 60 * 24 * 365.25);

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
        const annualCoupon = this.faceValue * this.couponRate;
        const marketValue = this.faceValue * this.price.buy;
        return annualCoupon / marketValue;
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
        return this.solveYTMFromPrice(
            this.price.buy,
            this.maturity.years,
            iterations,
            tolerance
        );
    }



    private solveYTMFromPrice(
        priceRatio: number,
        maturityYears: number,
        iterations = 100,
        tolerance = 1e-6
    ): number {

        if (maturityYears <= 0) return 0;

        const periods = Math.round(maturityYears * this.frequency);
        const coupon = (this.faceValue * this.couponRate) / this.frequency;

        let ytm = this.marketRate || this.couponRate;

        for (let i = 0; i < iterations; i++) {
            let f = 0;
            let df = 0;

            for (let t = 1; t <= periods; t++) {
                const discount = Math.pow(1 + ytm / this.frequency, t);
                f += coupon / discount;
                df -= (t * coupon) /
                    (this.frequency * discount * (1 + ytm / this.frequency));
            }

            const finalDiscount = Math.pow(1 + ytm / this.frequency, periods);
            f += this.faceValue / finalDiscount - priceRatio * this.faceValue;
            df -= (periods * this.faceValue) /
                (this.frequency * finalDiscount * (1 + ytm / this.frequency));

            if (Math.abs(df) < 1e-10) break;

            const next = ytm - f / df;
            if (!isFinite(next) || Math.abs(next - ytm) < tolerance) break;

            ytm = next;
        }

        return ytm;
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
        return this.computePriceForMode(rate, asOfDate, this.priceMode);
    }



    /**
     * Automatically computes the market rate for the bond (YTM).
     * Uses the current buy price (clean or dirty) without mutating state.
     */
    computeMarketRate(): void {
        const accrued = this.getAccruedInterest();

        const priceRatio =
            this.priceMode === PriceMode.Clean
                ? this.price.buy
                : this.price.buy + accrued / this.faceValue;

        this.marketRate = this.solveYTMFromPrice(
            priceRatio,
            this.maturity.years
        );
    }






    // --- Interest Rate Sensitivity ---

    /**
     * Macaulay Duration (clean-price basis).
     * Accrued interest is excluded by design.
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

    // --- Sell / Sale Methods ---

    /**
     * Returns the effective sell price to use for a given date.
     * Prefers manual sell price if set, otherwise uses market-based dirty price.
     */
    getSellPrice(asOfDate: string = new Date().toISOString()): number {
        if (this.price.sell != null) {
            return this.price.sell; // ratio
        }
        return this.getBondPrice(this.marketRate, asOfDate); // dirty price ratio
    }

    /**
     * Capital gains tax if sold at the current sell price.
     */
    getCapitalGainsTax(asOfDate: string = new Date().toISOString()): number {
        if (!this.tax.enabled || !this.tax.capitalGains) return 0;

        const sellPrice = this.getSellPrice(asOfDate);

        const capitalGain = this.faceValue * (sellPrice - this.price.buy);
        return capitalGain > 0 ? capitalGain * this.tax.capitalGains : 0;
    }

    /**
     * Net gain if sold at a specific date.
     * Accounts for capital gains, accrued interest, and initial investment.
     */
    getNetGainOnSale(asOfDate: string = new Date().toISOString()): number {
        const sellPrice = this.getSellPrice(asOfDate); // ratio
        const grossProceeds = sellPrice * this.faceValue + this.getAccruedInterest(asOfDate);
        const invested = this.faceValue * this.price.buy;

        // Subtract capital gains tax if applicable
        const capitalGainsTax = this.getCapitalGainsTax(asOfDate);

        const netGain = grossProceeds - invested - capitalGainsTax;
        return netGain;
    }

    /**
     * Total return as a ratio if sold at a specific date.
     */
    getTotalReturnOnSale(asOfDate: string = new Date().toISOString()): number {
        const invested = this.faceValue * this.price.buy;
        return this.getNetGainOnSale(asOfDate) / invested;
    }

    /**
     * Simulate a sale at a given date and return detailed summary.
     */
    simulateSale(asOfDate: string = new Date().toISOString()): BondSaleSummary {
        const cleanPrice = this.computePriceForMode(this.marketRate, asOfDate, PriceMode.Clean);
        const dirtyPrice = this.computePriceForMode(this.marketRate, asOfDate, PriceMode.Dirty);

        const accrued = this.getAccruedInterest(asOfDate);
        const sellPriceUsed = this.getSellPrice(asOfDate);
        const capitalGainsTax = this.getCapitalGainsTax(asOfDate);
        const netGain = this.getNetGainOnSale(asOfDate);

        return {
            asOfDate,
            cleanPrice: cleanPrice * this.faceValue,
            dirtyPrice: dirtyPrice * this.faceValue,
            accruedInterest: accrued,
            capitalGainsTax,
            netGain,
            sellPriceUsed,
        };
    }


    private computePriceForMode(
        rate: number = this.marketRate,
        asOfDate: string = new Date().toISOString(),
        mode: PriceMode = PriceMode.Clean
    ): number {
        let price = 0;

        const valuationDate = new Date(asOfDate);
        const issueDate = new Date(this.maturity.start);
        const elapsedYears =
            (valuationDate.getTime() - issueDate.getTime()) /
            (1000 * 60 * 60 * 24 * 365.25);

        const elapsedPeriods = elapsedYears * this.frequency;

        for (let t = 1; t <= this.totalPeriods; t++) {
            const time = t - elapsedPeriods;
            if (time <= 0) continue;

            price += this.couponPerPeriod /
                Math.pow(1 + rate / this.frequency, time);
        }


        price += this.faceValue / Math.pow(1 + rate / this.frequency, this.totalPeriods);
        price /= this.faceValue; // ratio

        if (mode === PriceMode.Dirty) {
            const accrued = this.getAccruedInterest(asOfDate);
            price += accrued / this.faceValue;
        }

        return price;
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



    setFaceValue(value: number): this {
        if (value <= 0) throw new Error("Face value must be positive");
        this.faceValue = value;
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
        this.computeYTMCurve();
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
        this.computeYTMCurve();


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
        this.computeYTMCurve();
        return this;
    }


    /**
    * Toggles the tax.
    * @param bool - Toggles the current value if unset.
    */
    toggleTax(bool?: boolean): this {

        this.tax.enabled = bool ?? !this.tax.enabled;
        this.recomputeDerivedData();

        return this;
    }

    setInterestFWT(rate: number): this {
        if (rate < 0 || rate > 1) throw new Error("Interest FWT must be between 0 and 1");
        this.tax.interestFWT = rate;
        this.recomputeDerivedData();
        return this;
    }

    setCapitalGains(rate: number): this {
        if (rate < 0 || rate > 1) throw new Error("Capital gains tax must be between 0 and 1");
        this.tax.capitalGains = rate;
        this.recomputeDerivedData();
        return this;
    }

    setEstateOrDonor(rate: number): this {
        if (rate < 0 || rate > 1) throw new Error("Estate/Donor tax must be between 0 and 1");
        this.tax.estateOrDonor = rate;
        this.recomputeDerivedData();
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

    private computeYTMCurve(options?: {
        points?: number;
        smoothing?: number;
        name?: string;
    }): void {

        const points = options?.points ?? 10;
        const smoothing = options?.smoothing ?? 0.8;

        const maturities: number[] = [];
        const ytms: number[] = [];

        for (let i = 1; i <= points; i++) {
            const minYears = 1 / this.frequency;
            const maturityYears = Math.max(
                minYears,
                (this.maturity.years / points) * i
            );


            maturities.push(maturityYears);
            ytms.push(
                this.solveYTMFromPrice(
                    this.price.buy,
                    maturityYears
                )
            );
        }

        this.ytm_curve = [
            {
                x: maturities,
                y: ytms,
                type: "scatter",
                mode: "lines+markers",
                name: options?.name ?? "YTM Curve",
                line: {
                    shape: "spline",
                    smoothing,
                    width: 2
                },
                marker: { size: 6 },
                hovertemplate:
                    "Maturity: %{x:.2f} yrs<br>YTM: %{y:.2%}<extra></extra>"
            }
        ];
    }



    /**
     * Generates a Plotly-ready YTM curve.
     *
     * @param options Optional curve configuration
     */
    get YTMCurve(): YTMCurvePlot[] {
        if (!this.ytm_curve) {
            this.computeYTMCurve();
        }
        return this.ytm_curve!;
    }


    private recomputeDerivedData(): void {
        this.computeCashflowSummary();
    }

    private getAccruedInterest(asOfDate: string = new Date().toISOString()): number {
        if (this.totalPeriods === 0) return 0;

        const periodMonths = 12 / this.frequency;
        const issueDate = new Date(this.maturity.start);
        const valuationDate = new Date(asOfDate);

        let lastCouponDate = new Date(issueDate);
        let nextCouponDate = new Date(issueDate);

        for (let p = 1; p <= this.totalPeriods; p++) {
            nextCouponDate = new Date(lastCouponDate);
            nextCouponDate.setMonth(nextCouponDate.getMonth() + periodMonths);

            if (valuationDate < nextCouponDate) break;
            lastCouponDate = new Date(nextCouponDate);
        }

        if (valuationDate <= lastCouponDate) return 0;

        const yearFraction = DayCountCalculator.yearFraction(
            lastCouponDate,
            valuationDate,
            this.dayCount
        );

        let accruedInterest = this.faceValue * this.couponRate * yearFraction;

        if (this.tax.enabled && this.tax.interestFWT) {
            accruedInterest *= (1 - this.tax.interestFWT);
        }

        return accruedInterest;
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

        const parsedInstance = MajikBond.initialize(
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
        return parsedInstance;
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

