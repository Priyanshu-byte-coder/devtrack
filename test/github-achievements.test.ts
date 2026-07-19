import { describe, it, expect } from "vitest";
import {
  decodeHtml,
  stripTags,
  titleFromSlug,
  slugFromTitle,
  absoluteGitHubUrl,
  getHtmlAttribute,
  slugFromAchievementImage,
  sanitizeGitHubLogin,
} from "../src/lib/github-achievements";

describe("github-achievements parsing utilities", () => {
  describe("decodeHtml", () => {
    it("decodes &amp; to &", () => {
      expect(decodeHtml("foo &amp; bar")).toBe("foo & bar");
    });

    it("decodes &quot; to double quote", () => {
      expect(decodeHtml("&quot;quoted&quot;")).toBe('"quoted"');
    });

    it("decodes &#39; to single quote", () => {
      expect(decodeHtml("&#39;quoted&#39;")).toBe("'quoted'");
    });

    it("decodes &lt; to <", () => {
      expect(decodeHtml("&lt;div&gt;")).toBe("<div>");
    });

    it("decodes &gt; to >", () => {
      expect(decodeHtml("&lt;div&gt;")).toBe("<div>");
    });

    it("decodes multiple entities in sequence", () => {
      expect(decodeHtml("&lt;tag&gt; &amp; &quot;quote&quot; &#39;apostrophe&#39;")).toBe(
        '<tag> & "quote" \'apostrophe\''
      );
    });

    it("returns input unchanged when no entities present", () => {
      expect(decodeHtml("plain text")).toBe("plain text");
    });
  });

  describe("stripTags", () => {
    it("removes simple HTML tags", () => {
      expect(stripTags("<b>bold</b>")).toBe("bold");
    });

    it("removes nested tags", () => {
      expect(stripTags("<div><span>nested</span></div>")).toBe("nested");
    });

    it("collapses whitespace", () => {
      expect(stripTags("<div>   spaced   </div>")).toBe("spaced");
    });

    it("trims leading and trailing whitespace", () => {
      expect(stripTags("  <div>text</div>  ")).toBe("text");
    });

    it("decodes HTML entities in stripped content", () => {
      expect(stripTags("<span>&#39;quoted&#39;</span>")).toBe("'quoted'");
    });

    it("handles empty string", () => {
      expect(stripTags("")).toBe("");
    });

    it("handles string with no tags", () => {
      expect(stripTags("plain text")).toBe("plain text");
    });
  });

  describe("titleFromSlug", () => {
    it("converts simple slug to title case", () => {
      expect(titleFromSlug("hello-world")).toBe("Hello World");
    });

    it("handles single word slug", () => {
      expect(titleFromSlug("hello")).toBe("Hello");
    });

    it("filters empty parts", () => {
      expect(titleFromSlug("one--multiple---words")).toBe("One Multiple Words");
    });

    it("capitalizes first letter of each part", () => {
      expect(titleFromSlug("pull-shark")).toBe("Pull Shark");
    });

    it("handles achievement-style slugs", () => {
      expect(titleFromSlug("arctic-code-vault-contributor")).toBe(
        "Arctic Code Vault Contributor"
      );
    });
  });

  describe("slugFromTitle", () => {
    it("converts simple title to slug", () => {
      expect(slugFromTitle("Hello World")).toBe("hello-world");
    });

    it("converts to lowercase", () => {
      expect(slugFromTitle("Hello World")).toBe("hello-world");
    });

    it("replaces spaces with hyphens", () => {
      expect(slugFromTitle("hello   world")).toBe("hello-world");
    });

    it("removes non-alphanumeric characters", () => {
      expect(slugFromTitle("Hello! World?")).toBe("hello-world");
    });

    it("trims leading and trailing hyphens", () => {
      expect(slugFromTitle("  hello world  ")).toBe("hello-world");
    });

    it("handles multiple spaces between words", () => {
      expect(slugFromTitle("hello    world")).toBe("hello-world");
    });

    it("is reversible with titleFromSlug for simple titles", () => {
      const title = "Hello World";
      expect(slugFromTitle(title)).toBe("hello-world");
    });
  });

  describe("absoluteGitHubUrl", () => {
    it("returns https URLs unchanged", () => {
      expect(absoluteGitHubUrl("https://github.com/user/repo")).toBe(
        "https://github.com/user/repo"
      );
    });

    it("returns http URLs unchanged", () => {
      expect(absoluteGitHubUrl("http://github.com/user/repo")).toBe(
        "http://github.com/user/repo"
      );
    });

    it("prepends https to protocol-relative URLs", () => {
      expect(absoluteGitHubUrl("//github.com/user/repo")).toBe(
        "https://github.com/user/repo"
      );
    });

    it("prepends GitHub base URL to absolute paths", () => {
      expect(absoluteGitHubUrl("/user/repo")).toBe(
        "https://github.com/user/repo"
      );
    });

    it("returns relative paths with GitHub base URL", () => {
      expect(absoluteGitHubUrl("/settings/keys")).toBe(
        "https://github.com/settings/keys"
      );
    });

    it("returns decoded URLs unchanged if absolute", () => {
      expect(absoluteGitHubUrl("https://github.com/user/repo")).toBe(
        "https://github.com/user/repo"
      );
    });
  });

  describe("getHtmlAttribute", () => {
    it("extracts src attribute", () => {
      const tag = '<img src="image.png" alt="test">';
      expect(getHtmlAttribute(tag, "src")).toBe("image.png");
    });

    it("extracts alt attribute", () => {
      const tag = '<img src="image.png" alt="test image">';
      expect(getHtmlAttribute(tag, "alt")).toBe("test image");
    });

    it("returns null when attribute not found", () => {
      const tag = '<img src="image.png">';
      expect(getHtmlAttribute(tag, "alt")).toBeNull();
    });

    it("is case insensitive for attribute name", () => {
      const tag = '<img SRC="image.png">';
      expect(getHtmlAttribute(tag, "src")).toBe("image.png");
    });

    it("decodes HTML entities in attribute values", () => {
      const tag = '<img src="image.png" alt="test &amp; value">';
      expect(getHtmlAttribute(tag, "alt")).toBe("test & value");
    });

    it("handles empty attribute value", () => {
      const tag = '<img src="" alt="test">';
      expect(getHtmlAttribute(tag, "src")).toBeNull();
    });
  });

  describe("slugFromAchievementImage", () => {
    it("extracts slug from default badge image", () => {
      const url = "https://github.githubassets.com/images/modules/achievements/pull-shark-default-a1b2c3d4e5f6.png";
      expect(slugFromAchievementImage(url)).toBe("pull-shark");
    });

    it("extracts slug from badge image", () => {
      const url = "https://github.githubassets.com/images/modules/achievements/starstruck-badge-a1b2c3d4e5f6.png";
      expect(slugFromAchievementImage(url)).toBe("starstruck");
    });

    it("extracts slug from dark variant", () => {
      const url = "https://github.githubassets.com/images/modules/achievements/night-owl-dark-a1b2c3d4e5f6.png";
      expect(slugFromAchievementImage(url)).toBe("night-owl");
    });

    it("extracts slug from light variant", () => {
      const url = "https://github.githubassets.com/images/modules/achievements/early-bird-light-a1b2c3d4e5f6.png";
      expect(slugFromAchievementImage(url)).toBe("early-bird");
    });

    it("returns null for non-achievement images", () => {
      const url = "https://github.com/user/avatar.png";
      expect(slugFromAchievementImage(url)).toBeNull();
    });

    it("handles query strings in URL", () => {
      const url = "https://github.githubassets.com/images/modules/achievements/pull-shark-default-a1b2c3d4e5f6.png?v=1";
      expect(slugFromAchievementImage(url)).toBe("pull-shark");
    });

    it("returns null for short hash images", () => {
      const url = "https://github.githubassets.com/images/modules/achievements/pull-shark-default-12345.png";
      expect(slugFromAchievementImage(url)).toBeNull();
    });
  });

  describe("sanitizeGitHubLogin", () => {
    it("trims whitespace", () => {
      expect(sanitizeGitHubLogin("  username  ")).toBe("username");
    });

    it("removes @ prefix", () => {
      expect(sanitizeGitHubLogin("@username")).toBe("username");
    });

    it("handles @ prefix with whitespace", () => {
      expect(sanitizeGitHubLogin("  @username  ")).toBe("username");
    });

    it("returns username unchanged when no @ prefix", () => {
      expect(sanitizeGitHubLogin("username")).toBe("username");
    });

    it("handles empty string", () => {
      expect(sanitizeGitHubLogin("")).toBe("");
    });

    it("handles only whitespace", () => {
      expect(sanitizeGitHubLogin("   ")).toBe("");
    });
  });
});