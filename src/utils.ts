import { DateTime } from "luxon";
import { DayCountConvention } from "./enums";

export class DayCountCalculator {

  /**
   * Compute year fraction between two Date objects using standard financial conventions.
   *
   * @param startDate - Start date (JS Date)
   * @param endDate - End date (JS Date)
   * @param convention - One of DayCountConvention
   * @returns year fraction as a decimal
   */
  static yearFraction(
    startDate: Date,
    endDate: Date,
    convention: DayCountConvention
  ): number {
    const start = DateTime.fromJSDate(startDate, { zone: "utc" });
    const end = DateTime.fromJSDate(endDate, { zone: "utc" });

    if (!start.isValid || !end.isValid || end <= start) {
      return 0;
    }

    switch (convention) {
      case DayCountConvention.ACTUAL_ACTUAL:
        return this.actualActual(start, end);

      case DayCountConvention.ACTUAL_360:
        return this.actual(start, end) / 360;

      case DayCountConvention.ACTUAL_365:
        return this.actual(start, end) / 365;

      case DayCountConvention.THIRTY_360:
      case DayCountConvention.THIRTY_U_360:
        return this.thirtyUS360(start, end);

      case DayCountConvention.THIRTY_E_360:
        return this.thirtyE360(start, end);

      default:
        throw new Error(`Day count convention not implemented: ${convention}`);
    }
  }

  private static actual(start: DateTime, end: DateTime): number {
    return Math.abs(end.diff(start, "days").days);
  }

  private static actualActual(start: DateTime, end: DateTime): number {
    let sum = 0;
    let current = start;

    while (current < end) {
      const yearEnd = current.endOf("year");
      const nextBreak = yearEnd < end ? yearEnd.plus({ days: 1 }) : end;
      const daysInYear = current.isInLeapYear ? 366 : 365;
      sum += Math.abs(nextBreak.diff(current, "days").days) / daysInYear;
      current = nextBreak;
    }

    return sum;
  }

  /** 30/360 US (Bond Basis) */
  private static thirtyUS360(start: DateTime, end: DateTime): number {
    let d1 = start.day;
    let d2 = end.day;

    if (d1 === 31) d1 = 30;
    if (d2 === 31 && d1 >= 30) d2 = 30;

    const days360 = (end.year - start.year) * 360 +
      (end.month - start.month) * 30 +
      (d2 - d1);

    return days360 / 360;
  }

  /** 30E/360 (European) */
  private static thirtyE360(start: DateTime, end: DateTime): number {
    const d1 = start.day === 31 ? 30 : start.day;
    const d2 = end.day === 31 ? 30 : end.day;

    const days360 = (end.year - start.year) * 360 +
      (end.month - start.month) * 30 +
      (d2 - d1);

    return days360 / 360;
  }
}
