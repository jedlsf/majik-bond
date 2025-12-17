import { DayCountConvention } from "./enums";

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
 * Represents the result of simulating a bond sale.
 */
export interface BondSaleSummary {
  /** Date of the sale simulation */
  asOfDate: ISODateString;

  /** Clean price of the bond (excluding accrued interest) */
  cleanPrice: number;

  /** Dirty price of the bond (including accrued interest) */
  dirtyPrice: number;

  /** Accrued interest up to the sale date */
  accruedInterest: number;

  /** Capital gains tax on the sale */
  capitalGainsTax: number;

  /** Net gain from the sale after taxes and accrued interest */
  netGain: number;

  sellPriceUsed: number;
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
    sell?: number | null;
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
 * Plotly-compatible YTM curve trace.
 */
export interface YTMCurvePlot {
  x: number[];              // maturities in years
  y: number[];              // YTM values
  type: "scatter";
  mode: "lines+markers";
  name: string;

  line: {
    shape: "spline";
    smoothing: number;
    width?: number;
  };

  marker?: {
    size?: number;
  };

  hovertemplate?: string;
}
