import { stroopsToXLM, formatRewardXLM, STROOPS_PER_XLM } from "@/lib/stellar-amount";

describe("stroopsToXLM", () => {
  it("converts whole XLM amounts", () => {
    expect(stroopsToXLM(STROOPS_PER_XLM.toString())).toBe("1");
    expect(stroopsToXLM((STROOPS_PER_XLM * 100n).toString())).toBe("100");
    expect(stroopsToXLM((STROOPS_PER_XLM * 1000n).toString())).toBe("1000");
  });

  it("converts fractional XLM amounts and trims trailing zeros", () => {
    expect(stroopsToXLM("15000000")).toBe("1.5");
    expect(stroopsToXLM("10000001")).toBe("1.0000001");
    expect(stroopsToXLM("12345678")).toBe("1.2345678");
    expect(stroopsToXLM("10000010")).toBe("1.000001");
  });

  it("handles values less than 1 XLM", () => {
    expect(stroopsToXLM("1")).toBe("0.0000001");
    expect(stroopsToXLM("100")).toBe("0.00001");
    expect(stroopsToXLM("10000")).toBe("0.001");
  });

  it("handles zero", () => {
    expect(stroopsToXLM("0")).toBe("0");
    expect(stroopsToXLM(0n)).toBe("0");
    expect(stroopsToXLM(0)).toBe("0");
  });

  it("accepts number and bigint inputs", () => {
    expect(stroopsToXLM(STROOPS_PER_XLM)).toBe("1");
    expect(stroopsToXLM(STROOPS_PER_XLM * 5n)).toBe("5");
  });

  it("returns '0' on invalid input", () => {
    expect(stroopsToXLM("not-a-number")).toBe("0");
    expect(stroopsToXLM("")).toBe("0");
  });

  it("handles negative values", () => {
    expect(stroopsToXLM("-10000000")).toBe("-1");
    expect(stroopsToXLM("-1")).toBe("-0.0000001");
  });
});

describe("formatRewardXLM", () => {
  it("formats whole XLM amounts with unit", () => {
    expect(formatRewardXLM("10000000")).toBe("1 XLM");
    expect(formatRewardXLM("15000000")).toBe("1.5 XLM");
    expect(formatRewardXLM(STROOPS_PER_XLM * 250n)).toBe("250 XLM");
  });

  it("returns 'Reward TBD' for null or undefined", () => {
    expect(formatRewardXLM(null)).toBe("Reward TBD");
    expect(formatRewardXLM(undefined)).toBe("Reward TBD");
    expect(formatRewardXLM("")).toBe("Reward TBD");
  });

  it("returns 'Reward TBD' for invalid input", () => {
    expect(formatRewardXLM("not-a-number")).toBe("Reward TBD");
  });
});
