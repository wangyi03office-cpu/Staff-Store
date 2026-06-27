/**
 * T1.5 · 默认货币参数 + 平台央行账户引导 + 央行操作（赠与 / 衰减）
 * 参数值属"待定的货币政策参数"（第 32 条），此处仅给占位默认值。
 * 加成税不是独立操作——它是结算（M2）里平台的那份分成（第 19/28.4 条）。
 */
import { Ledger } from "./ledger.js";
import type { Posting } from "./ledger.js";

export interface MonetaryParams {
  platformAccountId: string;
  defaultBaseFee: number; // 默认岗位基准费 (CC)
  baseFeeByRole: Record<string, number>; // 各岗位基准费（第 18 条按岗位定）
  grantAmount: number; // 新进场赠与额度 (CC)
  defaultCreditLimit: number; // 常规账户负值下限
  revenueShare: { author: number; packager: number; platform: number };
  demurrageRate: number; // 衰减率（非关键路径）
}

export const DEFAULT_PARAMS: MonetaryParams = {
  platformAccountId: "platform",
  defaultBaseFee: 10,
  baseFeeByRole: {},
  grantAmount: 100,
  defaultCreditLimit: 50,
  revenueShare: { author: 0.6, packager: 0.2, platform: 0.2 },
  demurrageRate: 0.02,
};

/** 岗位基准费：优先用岗位专属，否则默认（第 18 条）。 */
export function baseFeeFor(params: MonetaryParams, role: string): number {
  return params.baseFeeByRole[role] ?? params.defaultBaseFee;
}

/** 引导：开出平台央行账户（可无限负，第 28 条）。 */
export function bootstrap(ledger: Ledger, params: MonetaryParams = DEFAULT_PARAMS): void {
  ledger.openAccount(params.platformAccountId, "platform", Number.POSITIVE_INFINITY);
}

/**
 * 赠与（第 28.1 条）：平台 −G、对方 +G，不破坏 Σ=0。
 * 缺位规格说"赠与优先动用储备、超出为净发行"——内存版不区分，平台账户本就可无限负。
 */
export function grant(
  ledger: Ledger,
  params: MonetaryParams,
  to: string,
  amount: number = params.grantAmount,
): Posting {
  return ledger.post(
    [
      { account: params.platformAccountId, amount: -amount },
      { account: to, amount: +amount },
    ],
    "grant",
    `赠与 ${to} ${amount}CC`,
  );
}

/**
 * 衰减（第 28.3 条，非关键路径）：正余额按率缩减，蒸发部分回收进平台储备。
 */
export function demurrage(ledger: Ledger, params: MonetaryParams): Posting | null {
  const entries: { account: string; amount: number }[] = [];
  let toPlatform = 0;
  for (const a of ledger.allAccounts()) {
    if (a.kind !== "platform" && a.balance > 0) {
      const d = a.balance * params.demurrageRate;
      if (d > 0) {
        entries.push({ account: a.id, amount: -d });
        toPlatform += d;
      }
    }
  }
  if (entries.length === 0) return null;
  entries.push({ account: params.platformAccountId, amount: toPlatform });
  return ledger.post(entries, "demurrage", "衰减回收");
}
