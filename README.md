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
- Supports tax handling, including final withholding tax and capital gains.
- Update bond parameters dynamically: face value, coupon rate, buy/sell price, maturity, and payment frequency.
- Investment planning mode: input desired monthly income, and Majik Bond calculates the principal needed to meet it.
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

const bond = new MajikBond({
  faceValue: 100000,          // Principal amount
  couponRate: 0.06,           // 6% annual coupon
  maturityYears: 5,            // 5-year bond
  frequency: 2,               // Semi-annual coupons
  taxEnabled: true            // Include taxes
});

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

**Important:**
Always store the un-hashed encryption key and RQX in environment variables to prevent tampering and accidental exposure.


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



