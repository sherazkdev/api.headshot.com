export type CreditLedgerDoc = {
  uid: string;
  amount: number;
  direction: "debit" | "credit";
  reason: string;
  referenceId?: string;
  fromPassCredits: number;
  fromBonusCredits: number;
  remainingSpendable: number;
  createdAt: Date;
};
