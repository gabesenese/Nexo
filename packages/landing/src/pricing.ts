/**
 * The competitor comparison, computed rather than typed, so every figure on
 * the page traces to a rate a reader can check.
 *
 * Intercom publishes Fin at $0.99 USD per billable outcome
 * (https://www.intercom.com/pricing, checked 7 September 2026). Their $49/mo
 * base plan includes 50 outcomes, which at these volumes changes the total by
 * under a dollar, so it is not modelled separately.
 *
 * The comparison deliberately EXCLUDES Intercom's per-seat fees, which run
 * $29 to $132 per seat per month on their own helpdesk. That makes it
 * conservative: a customer using Intercom's helpdesk pays more than the
 * figure shown here, not less.
 *
 * Refresh both constants below when either moves. The FX rate in particular
 * is an assumption, not a live quote, and the page states it.
 */
export const FIN_USD_PER_RESOLUTION = 0.99;
export const RESOLUTION_RATE = 0.5;
export const USD_TO_CAD = 1.39;
export const COMPARISON_CHECKED = "September 2026";

const cad = new Intl.NumberFormat("en-CA");

export function intercomMonthly(conversations: number) {
  return Math.round(conversations * RESOLUTION_RATE * FIN_USD_PER_RESOLUTION * USD_TO_CAD);
}

export function formatCad(value: number) {
  return `C$${cad.format(value)}`;
}

/** Volumes mirror PLANS in packages/server/src/config/plans.ts. */
export const PLAN_ROWS = [
  { name: "Essentials", conversations: 1500, price: 249 },
  { name: "Professional", conversations: 8000, price: 899 },
  { name: "Growth", conversations: 50000, price: 2499 },
].map((row) => {
  const intercom = intercomMonthly(row.conversations);
  return {
    ...row,
    intercom,
    keep: intercom - row.price,
    /** How much of the incumbent's bill our price represents. */
    share: `${Math.round((row.price / intercom) * 100)}%`,
  };
});
