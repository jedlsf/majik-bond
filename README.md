# Majik Bond

**Majik Bond** is a lightweight JavaScript/TypeScript library for **modeling bonds, calculating yields, cashflows, and tax effects**.  
It’s ideal for scenarios where you want to **estimate bond returns, plan investments, or simulate different bond strategies** without manually crunching the numbers.

---

### Live Demo

[![Majik Bond Thumbnail](https://www.thezelijah.world/_next/static/media/WA_Tools_Finance_MajikBond.92625cdf.webp)](https://www.thezelijah.world/tools/finance-majik-bond)

> Click the image to try Majik Blob.

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

## What’s New in This Version

This release introduces major improvements, added features, and better TypeScript support:

### Core Enhancements

- Fully TypeScript-friendly, with strict types for cashflows, bond parameters, tax, and YTM curves.
- Improved constructor and initialization logic via MajikBond.initialize() with sensible defaults.
- Chainable setter methods (setFaceValue, setCouponRate, setBuyPrice, etc.) for fluent updates.
- Flexible maturity handling: supports both numeric years or explicit date ranges.

### Yield & Pricing

Yield calculations:

- Yield to Maturity (YTM) via Newton–Raphson numerical solver.
- Current Yield calculation.
- Price computation now fully supports clean and dirty price modes, including accrued interest.
- Macaulay and Modified Duration calculations for interest rate sensitivity.
- New computeMarketRate() method automatically updates market rate based on current price.

### Cashflow & Tax
Detailed cashflow tables with optional monthly breakdown.

Tax handling enhancements:
- Final Withholding Tax (FWT) on coupon interest
- Capital gains tax when sold before maturity
- Estate/Donor tax (informational)
- Methods to compute total interest, total cash received, total tax, and net gain.

### Sale & Investment Planning

- **simulateSale()** returns a complete sale summary with clean/dirty price, accrued interest, capital gains, and net gain.
- **getRequiredInvestmentForMonthlyIncome()** estimates the principal needed to achieve a desired monthly income.
- Methods for calculating net gain and total return for both held and sold bonds.

### Analytics & Visualization

- get **YTMCurve()** generates a [Plotly](https://plotly.com/javascript/react)-ready YTM curve for visualization.
- Option to configure points, smoothing, and curve name.

### API & Utilities

- **parseFromJSON()** and **toJSON()** for serialization/deserialization.
- Improved robustness: validation on negative coupon rates, zero or negative face value, and invalid tax rates.
- Private helper methods now encapsulate complex calculations, keeping the API clean.

### Miscellaneous

- Improved error handling for invalid maturity dates and negative values.
- Better documentation and inline JSDoc for all methods and properties.
- Flexible priceMode switching (Clean vs Dirty) with chainable API.


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



