import { DayCountConvention } from "./enums";

export class DayCountCalculator {

  static yearFraction(
    start: Date,
    end: Date,
    convention: DayCountConvention
  ): number {
    const msPerDay = 1000 * 60 * 60 * 24;
    const days = (end.getTime() - start.getTime()) / msPerDay;

    switch (convention) {
      case DayCountConvention.ACTUAL_360:
        return days / 360;

      case DayCountConvention.ACTUAL_365:
        return days / 365;

      case DayCountConvention.ACTUAL_ACTUAL: {
        const year = start.getFullYear();
        const isLeap = new Date(year, 1, 29).getMonth() === 1;
        return days / (isLeap ? 366 : 365);
      }

      default:
        throw new Error(`Day count ${convention} not implemented yet`);
    }
  }
}
