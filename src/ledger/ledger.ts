/**
 * T1.1–T1.4 · CC 账本（互助信用）
 * 落实第 26 条（Σ=0 不变量、交易时记账创造）、第 28 条（平台=央行账户豁免）、
 * 第 41/36 条精神（只追加 + 哈希链审计，可验证）。
 */
import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type AccountKind = "consumer" | "developer" | "platform";

export interface Account {
  id: string;
  kind: AccountKind;
  balance: number; // CC，可为负（= 欠网络的劳动）
  creditLimit: number; // 负值下限的绝对值；平台=央行账户为 Infinity（第 28 条豁免）
}

export interface Entry {
  account: string;
  amount: number; // +贷记 / -借记
}

export type PostingKind =
  | "trade"
  | "grant"
  | "settlement"
  | "markup-tax"
  | "demurrage"
  | "transfer";

export interface Posting {
  seq: number;
  at: string; // ISO
  kind: PostingKind;
  entries: Entry[];
  memo: string;
  prevHash: string;
  hash: string;
}

const EPS = 1e-9;
const GENESIS = "GENESIS";

export class Ledger {
  private accounts = new Map<string, Account>();
  private postings: Posting[] = [];
  private lastHash = GENESIS;

  constructor(private persistPath?: string) {}

  openAccount(id: string, kind: AccountKind, creditLimit: number): Account {
    const existing = this.accounts.get(id);
    if (existing) return existing;
    const acc: Account = {
      id,
      kind,
      balance: 0,
      creditLimit: kind === "platform" ? Number.POSITIVE_INFINITY : creditLimit,
    };
    this.accounts.set(id, acc);
    return acc;
  }

  getAccount(id: string): Account | undefined {
    return this.accounts.get(id);
  }
  hasAccount(id: string): boolean {
    return this.accounts.has(id);
  }
  balanceOf(id: string): number {
    return this.accounts.get(id)?.balance ?? 0;
  }
  allAccounts(): Account[] {
    return [...this.accounts.values()];
  }
  allPostings(): Posting[] {
    return [...this.postings];
  }

  /** 记一笔账：entries 必须 Σ=0（第 26 条），且各账户不得跌破信用下限（平台豁免）。 */
  post(entries: Entry[], kind: PostingKind, memo = ""): Posting {
    const sum = entries.reduce((s, e) => s + e.amount, 0);
    if (Math.abs(sum) > EPS) {
      throw new Error(`记账不平：Σ=${sum}（第 26 条互助信用须借贷成对、Σ=0）`);
    }
    for (const e of entries) {
      const acc = this.accounts.get(e.account);
      if (!acc) throw new Error(`账户不存在: ${e.account}`);
      const newBal = acc.balance + e.amount;
      if (newBal < -acc.creditLimit - EPS) {
        throw new Error(
          `账户 ${e.account} 跌破信用下限：${newBal.toFixed(2)} < ${(-acc.creditLimit).toFixed(2)}`,
        );
      }
    }
    for (const e of entries) {
      this.accounts.get(e.account)!.balance += e.amount;
    }
    const seq = this.postings.length;
    const at = new Date().toISOString();
    const body = JSON.stringify({ seq, at, kind, entries, memo });
    const hash = createHash("sha256").update(this.lastHash + body).digest("hex");
    const posting: Posting = { seq, at, kind, entries, memo, prevHash: this.lastHash, hash };
    this.postings.push(posting);
    this.lastHash = hash;
    if (this.persistPath) this.persist(posting);
    return posting;
  }

  /** Σ 全账户余额（应恒为 0，第 26 条）。 */
  totalBalance(): number {
    let s = 0;
    for (const a of this.accounts.values()) s += a.balance;
    return s;
  }
  assertZeroSum(): void {
    const t = this.totalBalance();
    if (Math.abs(t) > 1e-6) throw new Error(`Σ≠0 不变量被破坏: ${t}`);
  }

  /** 校验哈希链完整性（防篡改）。 */
  verifyChain(): boolean {
    let prev = GENESIS;
    for (const p of this.postings) {
      const body = JSON.stringify({
        seq: p.seq,
        at: p.at,
        kind: p.kind,
        entries: p.entries,
        memo: p.memo,
      });
      const h = createHash("sha256").update(prev + body).digest("hex");
      if (h !== p.hash || p.prevHash !== prev) return false;
      prev = h;
    }
    return true;
  }

  private persist(p: Posting): void {
    mkdirSync(dirname(this.persistPath!), { recursive: true });
    appendFileSync(this.persistPath!, JSON.stringify(p) + "\n", "utf8");
  }
}
