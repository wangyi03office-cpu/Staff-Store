import { describe, it, expect } from "vitest";
import { Ledger } from "./ledger.js";
import { DEFAULT_PARAMS, bootstrap, grant, demurrage } from "./config.js";

describe("CC 账本（互助信用，第 26/28 条）", () => {
  function setup() {
    const led = new Ledger();
    bootstrap(led, DEFAULT_PARAMS);
    return led;
  }

  it("平衡交易：Σ=0 保持，余额更新", () => {
    const led = setup();
    led.openAccount("a", "developer", 50);
    led.openAccount("b", "developer", 50);
    led.post([{ account: "a", amount: -10 }, { account: "b", amount: +10 }], "trade");
    expect(led.balanceOf("a")).toBe(-10);
    expect(led.balanceOf("b")).toBe(10);
    led.assertZeroSum();
  });

  it("不平账 → 抛错", () => {
    const led = setup();
    led.openAccount("a", "developer", 50);
    led.openAccount("b", "developer", 50);
    expect(() =>
      led.post([{ account: "a", amount: -10 }, { account: "b", amount: +5 }], "trade"),
    ).toThrow(/Σ=/);
  });

  it("跌破信用下限 → 抛错；平台账户豁免（可无限负）", () => {
    const led = setup();
    led.openAccount("a", "consumer", 50);
    led.openAccount("b", "developer", 50);
    expect(() =>
      led.post([{ account: "a", amount: -60 }, { account: "b", amount: +60 }], "trade"),
    ).toThrow(/信用下限/);
    // 平台可被赠与大额（自身无限负）
    grant(led, DEFAULT_PARAMS, "a", 1000);
    expect(led.balanceOf("platform")).toBe(-1000);
    led.assertZeroSum();
  });

  it("赠与：平台 −G、对方 +G、Σ=0", () => {
    const led = setup();
    led.openAccount("u", "consumer", 50);
    grant(led, DEFAULT_PARAMS, "u", 100);
    expect(led.balanceOf("u")).toBe(100);
    expect(led.balanceOf("platform")).toBe(-100);
    led.assertZeroSum();
  });

  it("哈希链可验证；篡改即失效", () => {
    const led = setup();
    led.openAccount("u", "consumer", 50);
    grant(led, DEFAULT_PARAMS, "u", 100);
    expect(led.verifyChain()).toBe(true);
    // 篡改一条记录的金额（grant 是第 0 笔）
    const p = led.allPostings()[0]!;
    (p.entries[0] as { amount: number }).amount = -999;
    expect(led.verifyChain()).toBe(false);
  });

  it("衰减：正余额缩减、回收进平台、Σ=0", () => {
    const led = setup();
    led.openAccount("dev", "developer", 50);
    grant(led, DEFAULT_PARAMS, "dev", 100); // dev +100
    demurrage(led, DEFAULT_PARAMS); // 2% → -2
    expect(led.balanceOf("dev")).toBeCloseTo(98, 6);
    led.assertZeroSum();
  });
});
