import { vi } from "vitest";

/**
 * A stand-in for a Supabase (PostgREST) query builder.
 *
 * Every filter method returns the same object, and the object is thenable, so
 * `await`ing it at any point in the chain resolves to `result`.
 *
 * Why this exists: mocks written as literal nestings —
 *
 *     from.mockReturnValue({ select: () => ({ not: () => result }) })
 *
 * encode the exact call chain a route used on the day the test was written.
 * Adding pagination or another filter to the route then breaks the test with
 * `.range is not a function`, even though nothing about the behaviour under
 * test changed. Several suites broke exactly that way when the digest and sync
 * routes gained `.order()` / `.range()`.
 *
 * Pass `result` as the resolved `{ data, error }` shape the route expects.
 */
export function supabaseQueryStub<T>(result: T) {
  const stub: Record<string, unknown> = {
    then: (
      resolve: (value: T) => unknown,
      reject?: (reason: unknown) => unknown
    ) => Promise.resolve(result).then(resolve, reject),
  };

  const chainable = [
    "select",
    "insert",
    "update",
    "upsert",
    "delete",
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "like",
    "ilike",
    "is",
    "in",
    "contains",
    "overlaps",
    "not",
    "or",
    "filter",
    "match",
    "order",
    "range",
    "limit",
    "abortSignal",
  ];

  for (const method of chainable) {
    stub[method] = vi.fn(() => stub);
  }

  // Terminal methods resolve directly rather than continuing the chain.
  stub.single = vi.fn(() => Promise.resolve(result));
  stub.maybeSingle = vi.fn(() => Promise.resolve(result));
  stub.csv = vi.fn(() => Promise.resolve(result));

  return stub;
}
