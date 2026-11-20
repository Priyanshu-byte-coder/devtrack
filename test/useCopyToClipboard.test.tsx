import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  COPY_FEEDBACK_MS,
  copyToClipboard,
  useCopyToClipboard,
} from "@/hooks/useCopyToClipboard";

const writeText = vi.fn<(text: string) => Promise<void>>();

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, "clipboard", {
    value,
    configurable: true,
  });
}

function setExecCommand(value: unknown) {
  Object.defineProperty(document, "execCommand", {
    value,
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  setClipboard({ writeText });
});

afterEach(() => {
  vi.useRealTimers();
  setClipboard(undefined);
  setExecCommand(undefined);
});

describe("copyToClipboard", () => {
  it("writes through the async Clipboard API when it exists", async () => {
    await copyToClipboard("hello");
    expect(writeText).toHaveBeenCalledExactlyOnceWith("hello");
  });

  it("rejects when the Clipboard API refuses the write", async () => {
    writeText.mockRejectedValue(new Error("NotAllowedError"));
    await expect(copyToClipboard("hello")).rejects.toThrow("NotAllowedError");
  });

  it("falls back to a hidden textarea without the Clipboard API", async () => {
    setClipboard(undefined);
    let copiedValue: string | undefined;
    const execCommand = vi.fn(() => {
      copiedValue = document.querySelector("textarea")?.value;
      return true;
    });
    setExecCommand(execCommand);

    const button = document.createElement("button");
    document.body.appendChild(button);
    button.focus();

    await copyToClipboard("from textarea");

    expect(execCommand).toHaveBeenCalledExactlyOnceWith("copy");
    expect(copiedValue).toBe("from textarea");
    expect(document.querySelector("textarea")).toBeNull();
    expect(document.activeElement).toBe(button);
    button.remove();
  });

  it("rejects when the fallback copy command fails", async () => {
    setClipboard(undefined);
    setExecCommand(vi.fn(() => false));

    await expect(copyToClipboard("nope")).rejects.toThrow(
      "Copy command was rejected"
    );
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("rejects when the browser offers no way to copy", async () => {
    setClipboard(undefined);
    await expect(copyToClipboard("nope")).rejects.toThrow();
  });
});

describe("useCopyToClipboard", () => {
  it("shows the copied state for a moment after a successful copy", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCopyToClipboard());
    expect(result.current.isCopied()).toBe(false);

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.copy("text");
    });

    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith("text");
    expect(result.current.isCopied()).toBe(true);

    act(() => vi.advanceTimersByTime(COPY_FEEDBACK_MS - 1));
    expect(result.current.isCopied()).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.isCopied()).toBe(false);
  });

  it("reports a failed copy without showing the copied state", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    const { result } = renderHook(() => useCopyToClipboard());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.copy("text");
    });

    expect(ok).toBe(false);
    expect(result.current.isCopied()).toBe(false);
  });

  it("marks only the item that was copied", async () => {
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy("first", "a");
    });
    expect(result.current.isCopied("a")).toBe(true);
    expect(result.current.isCopied("b")).toBe(false);
    expect(result.current.isCopied()).toBe(false);

    await act(async () => {
      await result.current.copy("second", "b");
    });
    expect(result.current.isCopied("a")).toBe(false);
    expect(result.current.isCopied("b")).toBe(true);
  });

  it("restarts the timer when copying again", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy("one");
    });
    act(() => vi.advanceTimersByTime(COPY_FEEDBACK_MS - 500));
    await act(async () => {
      await result.current.copy("two");
    });

    // The first copy's timer would have fired here.
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.isCopied()).toBe(true);
    act(() => vi.advanceTimersByTime(COPY_FEEDBACK_MS - 1000));
    expect(result.current.isCopied()).toBe(false);
  });

  it("honours a custom reset delay", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCopyToClipboard(500));

    await act(async () => {
      await result.current.copy("text");
    });
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.isCopied()).toBe(false);
  });

  it("clears its timer on unmount", async () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy("text");
    });
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not start a timer when the copy settles after unmount", async () => {
    vi.useFakeTimers();
    let finishWrite: () => void = () => {};
    writeText.mockReturnValue(
      new Promise<void>((resolve) => {
        finishWrite = resolve;
      })
    );
    const { result, unmount } = renderHook(() => useCopyToClipboard());

    const pending = result.current.copy("text");
    unmount();
    finishWrite();

    await expect(pending).resolves.toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
