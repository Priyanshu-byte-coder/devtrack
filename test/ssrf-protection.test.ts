import { ipToNumber, isPrivateIP, validateUrlBasic } from "../src/lib/ssrf-protection";
import { describe, it, expect } from "vitest";

describe("ssrf-protection pure utility functions", () => {
  describe("ipToNumber", () => {
    it("should convert valid IPv4 addresses to numbers", () => {
      expect(ipToNumber("0.0.0.0")).toBe(0);
      expect(ipToNumber("255.255.255.255")).toBe(4294967295);
      expect(ipToNumber("192.168.1.1")).toBe(3232235777);
    });

    it("should return NaN for invalid formats (non-numeric parts, out-of-range values, wrong octet count)", () => {
      // non-numeric parts
      expect(ipToNumber("192.168.1.a")).toBeNaN();
      expect(ipToNumber("not.an.ip.address")).toBeNaN();
      // out-of-range values
      expect(ipToNumber("192.168.1.256")).toBeNaN();
      expect(ipToNumber("192.-1.1.1")).toBeNaN();
      // wrong octet count
      expect(ipToNumber("192.168.1")).toBeNaN();
      expect(ipToNumber("192.168.1.1.1")).toBeNaN();
      // other invalid formats
      expect(ipToNumber("")).toBeNaN();
    });
  });

  describe("isPrivateIP", () => {
    it("should return true for all five private IPv4 ranges", () => {
      // 10.0.0.0/8
      expect(isPrivateIP("10.0.0.0")).toBe(true);
      expect(isPrivateIP("10.255.255.255")).toBe(true);
      // 172.16.0.0/12
      expect(isPrivateIP("172.16.0.0")).toBe(true);
      expect(isPrivateIP("172.31.255.255")).toBe(true);
      // 192.168.0.0/16
      expect(isPrivateIP("192.168.0.0")).toBe(true);
      expect(isPrivateIP("192.168.255.255")).toBe(true);
      // 127.0.0.0/8
      expect(isPrivateIP("127.0.0.0")).toBe(true);
      expect(isPrivateIP("127.255.255.255")).toBe(true);
      expect(isPrivateIP("127.0.0.1")).toBe(true);
      // 169.254.0.0/16
      expect(isPrivateIP("169.254.0.0")).toBe(true);
      expect(isPrivateIP("169.254.255.255")).toBe(true);
    });

    it("should return true for IPv6 loopback and link-local addresses", () => {
      expect(isPrivateIP("::1")).toBe(true);
      expect(isPrivateIP("::")).toBe(true);
      expect(isPrivateIP("fe80::1")).toBe(true);
      expect(isPrivateIP("fc00::1")).toBe(true);
      expect(isPrivateIP("fd00::1")).toBe(true);
    });

    it("should handle IPv6-mapped IPv4 addresses correctly", () => {
      // mapped private
      expect(isPrivateIP("::ffff:127.0.0.1")).toBe(true);
      expect(isPrivateIP("::ffff:192.168.1.1")).toBe(true);
      // mapped public
      expect(isPrivateIP("::ffff:8.8.8.8")).toBe(false);
    });

    it("should verify public IPs are not flagged", () => {
      expect(isPrivateIP("8.8.8.8")).toBe(false);
      expect(isPrivateIP("1.1.1.1")).toBe(false);
      // Just outside private ranges
      expect(isPrivateIP("172.32.0.0")).toBe(false);
      expect(isPrivateIP("192.169.0.0")).toBe(false);
      expect(isPrivateIP("9.255.255.255")).toBe(false);
      expect(isPrivateIP("11.0.0.0")).toBe(false);
      // Public IPv6
      expect(isPrivateIP("2001:4860:4860::8888")).toBe(false);
    });
  });

  describe("validateUrlBasic", () => {
    it("should return true for http and https URLs", () => {
      expect(validateUrlBasic("http://example.com")).toBe(true);
      expect(validateUrlBasic("https://example.com")).toBe(true);
      expect(validateUrlBasic("http://example.com:8080/path?query=1#hash")).toBe(true);
    });

    it("should return false for other protocols (ftp, data:, javascript:)", () => {
      expect(validateUrlBasic("ftp://example.com")).toBe(false);
      expect(validateUrlBasic("data:text/plain;base64,SGVsbG8=")).toBe(false);
      expect(validateUrlBasic("javascript:alert(1)")).toBe(false);
      expect(validateUrlBasic("file:///etc/passwd")).toBe(false);
    });

    it("should return false for malformed URLs", () => {
      expect(validateUrlBasic("not-a-url")).toBe(false);
      expect(validateUrlBasic("://example.com")).toBe(false);
      expect(validateUrlBasic("")).toBe(false);
      expect(validateUrlBasic("example.com")).toBe(false);
    });
  });
});
