import { describe, it, expect } from "vitest";
// @ts-ignore
import nextConfig from "../next.config.mjs";

describe("Security Headers Configuration", () => {
  it("should define all recommended security headers on the root path matching pattern", async () => {
    expect(nextConfig.headers).toBeTypeOf("function");
    if (!nextConfig.headers) {
      throw new Error("nextConfig.headers is undefined");
    }
    
    const headersResult = await nextConfig.headers();
    expect(Array.isArray(headersResult)).toBe(true);
    expect(headersResult.length).toBeGreaterThan(0);
    
    const rootRouteConfig = headersResult.find((config: any) => config.source === "/(.*)");
    expect(rootRouteConfig).toBeDefined();
    if (!rootRouteConfig) {
      throw new Error("rootRouteConfig is undefined");
    }
    
    const headers = rootRouteConfig.headers;
    const headerMap = new Map<string, string>(headers.map((h: any) => [h.key, h.value]));
    
    // Assert X-Content-Type-Options is nosniff to prevent MIME sniffing
    expect(headerMap.get("X-Content-Type-Options")).toBe("nosniff");
    
    // Assert Referrer-Policy is strict-origin-when-cross-origin to prevent referrer leakage
    expect(headerMap.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    
    // Assert X-Frame-Options is DENY to prevent clickjacking
    expect(headerMap.get("X-Frame-Options")).toBe("DENY");
    
    // Assert Strict-Transport-Security is present
    expect(headerMap.get("Strict-Transport-Security")).toBeDefined();
    
    // Assert Content-Security-Policy is present
    expect(headerMap.get("Content-Security-Policy")).toBeDefined();
    
    // Assert X-XSS-Protection is present
    expect(headerMap.get("X-XSS-Protection")).toBe("1; mode=block");
  });
});
