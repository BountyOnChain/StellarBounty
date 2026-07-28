/**
 * Unit tests for the standalone helper functions in app/page.tsx:
 *   getRewardValue, getDeadlineValue, applyListingControls,
 *   normalizePage, normalizeLimit, normalizeSort, normalizeStatus
 */
import {
  getRewardValue,
  getDeadlineValue,
  applyListingControls,
  normalizePage,
  normalizeLimit,
  normalizeSort,
  normalizeStatus,
} from "./page";

describe("getRewardValue", () => {
  it("returns the number as-is for a numeric reward", () => {
    expect(getRewardValue(150)).toBe(150);
    expect(getRewardValue(0)).toBe(0);
    expect(getRewardValue(-5)).toBe(-5);
  });

  it("parses a string reward with a prefix", () => {
    expect(getRewardValue("150 XLM")).toBe(150);
    expect(getRewardValue("1,000.5 RTC")).toBe(1000.5);
  });

  it("returns -1 for a non-numeric string", () => {
    expect(getRewardValue("free")).toBe(-1);
    expect(getRewardValue("")).toBe(-1);
  });

  it("returns -1 for null", () => {
    expect(getRewardValue(null)).toBe(-1);
  });

  it("returns -1 for undefined", () => {
    expect(getRewardValue(undefined)).toBe(-1);
  });
});

describe("getDeadlineValue", () => {
  it("returns a finite timestamp for a valid date string", () => {
    const ts = getDeadlineValue("2026-08-01T00:00:00Z");
    expect(Number.isFinite(ts)).toBe(true);
    expect(ts).toBeGreaterThan(0);
  });

  it("returns Infinity for null", () => {
    expect(getDeadlineValue(null)).toBe(Number.POSITIVE_INFINITY);
  });

  it("returns Infinity for undefined", () => {
    expect(getDeadlineValue(undefined)).toBe(Number.POSITIVE_INFINITY);
  });

  it("returns Infinity for an invalid date string", () => {
    expect(getDeadlineValue("not-a-date")).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("normalizePage", () => {
  it("returns the parsed number for a valid string", () => {
    expect(normalizePage("3")).toBe(3);
  });

  it("defaults to 1 for undefined", () => {
    expect(normalizePage(undefined)).toBe(1);
  });

  it("defaults to 1 for a non-numeric string", () => {
    expect(normalizePage("abc")).toBe(1);
  });

  it("defaults to 1 for a value below 1", () => {
    expect(normalizePage("0")).toBe(1);
  });
});

describe("normalizeLimit", () => {
  it("returns the parsed number for a valid string", () => {
    expect(normalizeLimit("20")).toBe(20);
  });

  it("defaults to 20 for undefined", () => {
    expect(normalizeLimit(undefined)).toBe(20);
  });

  it("caps at 100", () => {
    expect(normalizeLimit("200")).toBe(100);
  });

  it("defaults to 20 for a value below 1", () => {
    expect(normalizeLimit("0")).toBe(20);
  });

  it("defaults to 20 for a non-numeric string", () => {
    expect(normalizeLimit("abc")).toBe(20);
  });
});

describe("normalizeSort", () => {
  it("passes through valid sort options", () => {
    expect(normalizeSort("newest")).toBe("newest");
    expect(normalizeSort("highest_reward")).toBe("highest_reward");
    expect(normalizeSort("closest_deadline")).toBe("closest_deadline");
  });

  it("defaults to 'newest' for undefined", () => {
    expect(normalizeSort(undefined)).toBe("newest");
  });

  it("defaults to 'newest' for an invalid sort option", () => {
    expect(normalizeSort("random")).toBe("newest");
  });
});

describe("normalizeStatus", () => {
  it("passes through valid status options", () => {
    expect(normalizeStatus("all")).toBe("all");
    expect(normalizeStatus("open")).toBe("open");
    expect(normalizeStatus("in_progress")).toBe("in_progress");
    expect(normalizeStatus("completed")).toBe("completed");
    expect(normalizeStatus("cancelled")).toBe("cancelled");
  });

  it("defaults to 'all' for undefined", () => {
    expect(normalizeStatus(undefined)).toBe("all");
  });

  it("defaults to 'all' for an invalid status", () => {
    expect(normalizeStatus("unknown")).toBe("all");
  });
});

describe("applyListingControls", () => {
  const sampleBounties = [
    {
      id: "1",
      title: "Build a frontend component",
      reward: "500 XLM",
      deadline: "2026-09-01T00:00:00Z",
      status: "open" as const,
    },
    {
      id: "2",
      title: "Write documentation",
      reward: "100 XLM",
      deadline: "2026-08-01T00:00:00Z",
      status: "open" as const,
    },
    {
      id: "3",
      title: "Fix security bug",
      reward: "1000 XLM",
      deadline: "2026-07-15T00:00:00Z",
      status: "in_progress" as const,
    },
    {
      id: "4",
      title: "Deprecated task",
      reward: "50 XLM",
      deadline: null,
      status: "completed" as const,
    },
  ];

  describe("sorting", () => {
    it("sorts by newest (default)", () => {
      const result = applyListingControls(sampleBounties, {
        sort: "newest",
        status: "all",
        search: "",
      });
      // Newest keeps original order (no custom sort for newest)
      expect(result[0].id).toBe("1");
    });

    it("sorts by highest reward", () => {
      const result = applyListingControls(sampleBounties, {
        sort: "highest_reward",
        status: "all",
        search: "",
      });
      expect(result[0].id).toBe("3"); // 1000 XLM
      expect(result[1].id).toBe("1"); // 500 XLM
      expect(result[2].id).toBe("2"); // 100 XLM
      expect(result[3].id).toBe("4"); // 50 XLM
    });

    it("sorts by closest deadline (null deadline treated as Infinity)", () => {
      const result = applyListingControls(sampleBounties, {
        sort: "closest_deadline",
        status: "all",
        search: "",
      });
      // 3 (2026-07-15) -> 2 (2026-08-01) -> 1 (2026-09-01) -> 4 (null = Infinity)
      expect(result[0].id).toBe("3");
      expect(result[1].id).toBe("2");
      expect(result[2].id).toBe("1");
      expect(result[3].id).toBe("4");
    });
  });

  describe("filtering", () => {
    it("filters by status", () => {
      const result = applyListingControls(sampleBounties, {
        sort: "newest",
        status: "open",
        search: "",
      });
      expect(result).toHaveLength(2);
      expect(result.every((b) => b.status === "open")).toBe(true);
    });

    it("returns all when status is 'all'", () => {
      const result = applyListingControls(sampleBounties, {
        sort: "newest",
        status: "all",
        search: "",
      });
      expect(result).toHaveLength(4);
    });

    it("returns empty array when no bounty matches the status", () => {
      const result = applyListingControls(sampleBounties, {
        sort: "newest",
        status: "cancelled",
        search: "",
      });
      expect(result).toHaveLength(0);
    });
  });

  describe("search", () => {
    it("filters by title (case-insensitive)", () => {
      const result = applyListingControls(sampleBounties, {
        sort: "newest",
        status: "all",
        search: "Frontend",
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("1");
    });

    it("returns empty array when search matches nothing", () => {
      const result = applyListingControls(sampleBounties, {
        sort: "newest",
        status: "all",
        search: "nonexistent",
      });
      expect(result).toHaveLength(0);
    });

    it("returns all when search is empty", () => {
      const result = applyListingControls(sampleBounties, {
        sort: "newest",
        status: "all",
        search: "",
      });
      expect(result).toHaveLength(4);
    });
  });

  describe("combined filters", () => {
    it("applies status and search together", () => {
      const result = applyListingControls(sampleBounties, {
        sort: "newest",
        status: "open",
        search: "doc",
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("2");
    });

    it("applies sorting, status, and search together", () => {
      const result = applyListingControls(sampleBounties, {
        sort: "highest_reward",
        status: "open",
        search: "",
      });
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("1"); // 500 XLM
      expect(result[1].id).toBe("2"); // 100 XLM
    });
  });
});