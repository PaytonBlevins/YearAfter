/** P6: integrate chosen work with the existing tax stack, once. Whole dollars. */
import { taxRate } from '@yearafter/careers';
import { businessTaxOn } from './businesses';
export function gigIncome(age: number, salary: number, shiftGross: number, freelanceGross: number) {
  const gross = shiftGross + freelanceGross;
  if (age < 18) return { gross, tax: 0, net: gross, taxableGross: 0 };
  const shiftTax = Math.max(
    0,
    Math.round((salary + shiftGross) * taxRate(salary + shiftGross)) -
      Math.round(salary * taxRate(salary)),
  );
  const tax = shiftTax + businessTaxOn(salary + shiftGross, freelanceGross);
  return { gross, tax, net: gross - tax, taxableGross: gross };
}
