import { RouteCache } from "../../src/infrastructure/RouteCache";
import type { Route } from "../../src/core/graph/types";

function fakeRoute(start: string, end: string): Route {
  return {
    nodes: [
      { name: start, kind: "service", publicExposed: true },
      { name: end, kind: "rds" },
    ],
    edges: [{ from: start, to: end }],
    meta: {
      startsFromPublic: true,
      endsAtSink: true,
      hasVulnerability: false,
      maxSeverity: null,
      length: 2,
    },
  };
}

describe("RouteCache", () => {
  beforeEach(() => RouteCache.flush());

  it("prime stores routes and size() returns 1", () => {
    RouteCache.prime([fakeRoute("a", "b")]);
    expect(RouteCache.size()).toBe(1);
    expect(RouteCache.get("all")).toBeDefined();
  });

  it("get returns undefined on cache miss", () => {
    expect(RouteCache.get("nope")).toBeUndefined();
  });

  it("get returns stored routes on cache hit", () => {
    const routes = [fakeRoute("a", "b")];
    RouteCache.set("k", routes);
    expect(RouteCache.get("k")).toBe(routes);
  });

  it("set stores additional filtered result sets", () => {
    RouteCache.prime([fakeRoute("a", "b")]);
    RouteCache.set("endsAtSink:AND", [fakeRoute("a", "b")]);
    expect(RouteCache.size()).toBe(2);
  });

  it("flush resets size to 0", () => {
    RouteCache.prime([fakeRoute("a", "b")]);
    RouteCache.set("endsAtSink:AND", [fakeRoute("a", "b")]);
    RouteCache.flush();
    expect(RouteCache.size()).toBe(0);
  });
});
