
/**
 * Entity issuing the bond.
 */
export enum BondIssuer {
    /** National government (e.g., PH Treasury, US Treasury) */
    GOVERNMENT = "Government",

    /** Private corporations */
    CORPORATE = "Corporate",

    /** Local government units */
    MUNICIPAL = "Municipal",

    /** Government-owned or controlled corporations */
    QUASI_GOVERNMENT = "Quasi-Government",
}

/**
 * Interest structure of the bond.
 */
export enum BondStructure {
    /** Fixed coupon rate throughout bond life */
    FIXED = "Fixed Rate",

    /** Coupon rate floats based on reference rate */
    FLOATING = "Floating Rate",

    /** No periodic coupons, issued at deep discount */
    ZERO_COUPON = "Zero Coupon",

    /** Coupon or principal linked to inflation index */
    INFLATION_LINKED = "Inflation Linked",
}

/**
 * Primary market segment the bond is offered to.
 */
export enum BondMarket {
    /** Offered to retail investors */
    RETAIL = "Retail",

    /** Offered to institutions only */
    INSTITUTIONAL = "Institutional",
}


/**
 * Day Count Conventions used in bond and interest calculations.
 * Values follow standard market notation.
 */
export enum DayCountConvention {
    /** 30/360 US (Bond Basis) */
    THIRTY_U_360 = "30U/360",

    /** 30/360 US (alias, commonly used in documentation) */
    THIRTY_360 = "30/360",

    /** 30E/360 (European) */
    THIRTY_E_360 = "30E/360",

    /** Actual / Actual (ISDA) */
    ACTUAL_ACTUAL = "ACTUAL/ACTUAL",

    /** Actual / 360 (Money Market) */
    ACTUAL_360 = "ACTUAL/360",

    /** Actual / 365 (Fixed) */
    ACTUAL_365 = "ACTUAL/365",
}


export enum PriceMode {
  Clean,
  Dirty
}

