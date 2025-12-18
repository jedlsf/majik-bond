# Majik Bond

**Majik Bond** is a lightweight JavaScript/TypeScript library for **modeling bonds, calculating yields, cashflows, and tax effects**.  
It’s ideal for scenarios where you want to **estimate bond returns, plan investments, or simulate different bond strategies** without manually crunching the numbers.

---

### Live Demo

[![Majik Bond Thumbnail](https://www.thezelijah.world/_next/static/media/WA_Tools_Finance_MajikBond.92625cdf.webp)](https://www.thezelijah.world/tools/finance-majik-bond)

> Click the image to try Majik Bond.

---

## ✨ Features

- Calculate coupon payments, total periods, and interest earned.
- Compute Yield to Maturity (YTM) and current yield for any bond scenario.
- Generate detailed cashflow tables, with optional monthly breakdowns.
- Handles taxes, including final withholding tax (FWT) and capital gains.
- Dynamically update bond parameters: face value, coupon rate, buy/sell price, maturity, and payment frequency.
- Investment planning mode: input desired monthly income, and Majik Bond calculates the principal required.
- Fully TypeScript-friendly, works in both Node.js and browser environments.

---

##  [Full API Docs](https://www.thezelijah.word/tools/finance-majik-bond/docs)
---

## 📦 Installation

```bash
npm i @thezelijah/majik-bond
```

---

## Usage

### Create a Bond Instance
```ts
import { MajikBond } from "@thezelijah/majik-bond";

const bond = MajikBond.initialize()
.setFaceValue(100000)    // Principal amount
.setCouponRate(0.06)     // 6% annual coupon
.toggleTax(true)  // Include taxes
.setIssueDate(new Date().toISOString()) // Defaults to now
.setMaturityDate(new Date().toISOString()) // auto computes maturity years duration
.setFrequency(2) // Accepts 1 | 2 | 4 | 12  - Use type `CouponFrequency`
;   

```


### View Bond Metrics
```ts
console.log("Coupon Payment per Period:", bond.getCouponPayment());
console.log("Total Interest Earned:", bond.getTotalInterestEarned());
console.log("Yield to Maturity (YTM):", bond.getYTM());
console.log("Current Yield:", bond.getCurrentYield());

```


### Generate Cashflow Summary
Array of periods with interest, principal, total, and tax.
```ts
const summary = bond.getCashflowSummary();
summary.forEach(period => {
  console.log(period.period, period.interest, period.principal, period.total, period.tax);
});
```


### Investment Planning (Majik Mode)
```ts
const targetMonthlyIncome = 5000;
const requiredPrincipal = bond.getRequiredInvestmentForMonthlyIncome(targetMonthlyIncome);

console.log(`Invest ${requiredPrincipal} to achieve ${targetMonthlyIncome} PHP/month`);
```

### Updating Bond Parameters Dynamically
```ts
bond.setFaceValue(120000);
bond.setCouponRate(0.07);        // 7% annual coupon
bond.setBuyPrice(0.98);          // Buy at discount
bond.setSellPrice(1.02);         // Sell at premium
bond.setMaturityDate(new Date("2030-12-31"));
bond.toggleTax(false);           // Disable tax

```


---

### Use Cases

- Personal or institutional bond investment planning
- Financial dashboards and portfolio simulators
- Cashflow modeling for different bond types
- Yield analysis and comparison across bonds
- Tax-adjusted investment strategies

### Best Practices

- Always double-check buy/sell prices to avoid skewed returns.
- Enable taxes only if applicable to your jurisdiction.
- Use cashflow tables to visualize income streams and plan withdrawals.
- Verify maturity dates to prevent accidental errors.
- Update bond parameters dynamically to model what-if scenarios.

# MajikBond – Patch Update / What’s New

**Version:** 1.1.0 (Major Rewrite)  
**Release Date:** 2025-12-19

## Overview

This release introduces a complete rewrite of MajikBond with a focus on precision, modularity, and maintainability. The new architecture leverages [MajikMoney](https://www.npmjs.com/package/@thezelijah/majik-money) and [Decimal.js](https://www.npmjs.com/package/decimal.js) for reliable financial computations and adopts a less monolithic, highly encapsulated design that is production-ready for global bond calculations.

## 🆕 Key Highlights

### 1. High-Precision Financial Calculations
- All monetary operations now utilize [MajikMoney](https://www.npmjs.com/package/@thezelijah/majik-money) and [Decimal.js](https://www.npmjs.com/package/decimal.js), ensuring no floating-point errors even in large-scale bond portfolios.  
- Cashflow, accrued interest, capital gains, and net gains are accurately computed in minor units, guaranteeing compliance with strict accounting standards.

### 2. Modular Architecture
Previously monolithic logic has been split into specialized modules:
- **BondPricing:** Price, YTM, duration, sensitivity, and investment calculations.  
- **BondCashflow:** Cashflow schedule generation and period-based computations.  
- **BondSale:** Stateless sale simulations, net gain, total return, and capital gains tax.  
- **BondAccrual & BondTax:** Accrued interest and tax computations.  

MajikBond now acts as a coordinator and facade, delegating calculation responsibilities to dedicated modules.

### 3. Encapsulation & Safety
- Internal state (tax engine, YTM curve, cashflow summary) is now private or read-only, preventing unintended mutations.  
- Chainable setters (`setFaceValue`, `setCouponRate`, `setMarketRate`, etc.) allow safe mutation with automatic recalculation.  
- All derived data (e.g., cashflow, market rate, YTM curve) is recomputed lazily or on-demand, optimizing performance.

### 4. Optimized Performance
- Cashflow schedule generation and YTM computations use **Decimal.js** for efficient and accurate iteration.  
- Accrued interest, coupon, and total cash calculations avoid redundant conversions, reducing CPU overhead for large portfolios.  
- Price and YTM calculations are numerically stable using Newton-Raphson with tolerance-based convergence.

### 5. Flexible & Global Bond Support
- Supports clean vs dirty price modes.  
- Day count conventions are fully configurable (ACTUAL_365, 30/360, etc.).  
- Works with any currency defined in **MajikMoney**, defaulting to Philippine Peso (PHP) but extensible globally.  
- Handles fractional coupon periods, end-of-month adjustments, and partial-year maturities.

### 6. Advanced Reporting & Simulation
- **BondSale** module allows full sale simulations, including:
  - Clean and dirty price  
  - Accrued interest  
  - Net gain including capital gains and taxes  
- Generates **Plotly-ready YTM curves** for visualization and sensitivity analysis.  
- Total return, modified duration, and investment planning are now numerically precise and easily extractable.

### 7. Improved Developer Experience
- Fully typed with **TypeScript**, including interfaces for cashflows, bond parameters, YTM curves, and sales summaries.  
- JSON serialization/deserialization via `toJSON` / `parseFromJSON` ensures safe persistence and retrieval.  
- Chainable API allows fluid, readable bond setup and adjustment.

### 8. Security & Robustness
- Input validation for all setters (e.g., coupon rate, price, tax rates).  
- Edge cases handled for negative gains, zero coupon bonds, and invalid dates.  
- Immutable internal computations minimize the risk of accidental state corruption.

## 🔧 Summary of Improvements

| Area                  | Before                     | Now                                                           |
|-----------------------|----------------------------|---------------------------------------------------------------|
| Monetary calculations  | Raw numbers                | MajikMoney + Decimal.js for precision                        |
| Architecture           | Monolithic                 | Modular, encapsulated, maintainable                          |
| Cashflow & accrual     | Simple arrays              | Full schedules with fractional periods & tax adjustments     |
| Price/YTM              | Single method              | Dedicated pricing engine with Newton-Raphson solver          |
| Simulation             | Limited                    | Full sale and net gain simulation with clean/dirty price distinction |
| Developer experience   | Basic setters              | Chainable, type-safe setters with auto-recalculation         |
| Reporting              | Manual                     | Plotly-ready YTM curves, cashflow summaries, net gain reports|

## Conclusion
This update transforms MajikBond into a **production-ready, finance-grade bond library** with accurate, robust, and modular computations. It is now suitable for real-world investment analysis, trading simulations, portfolio management, and financial reporting.

## Contributing

Contributions, bug reports, and suggestions are welcome! Feel free to fork and open a pull request.

---

## License

[ISC](LICENSE) — free for personal and commercial use.

---

## Author

Made with 💙 by [@thezelijah](https://github.com/jedlsf)


## About the Developer

- **Developer**: Josef Elijah Fabian  
- **GitHub**: [https://github.com/jedlsf](https://github.com/jedlsf)  
- **Project Repository**: [https://github.com/jedlsf/majik-bond](https://github.com/jedlsf/majik-bond)  

---

## Contact

- **Business Email**: [business@thezelijah.world](mailto:business@thezelijah.world)  
- **Official Website**: [https://www.thezelijah.world](https://www.thezelijah.world)  

---



