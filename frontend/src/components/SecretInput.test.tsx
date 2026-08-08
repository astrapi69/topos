import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { SecretInput } from "./SecretInput";

vi.mock("../hooks/useI18n", () => ({
  useI18n: () => ({ t: (_k: string, fb?: string) => fb ?? _k }),
}));

describe("SecretInput", () => {
  it("renders type=text (no password-manager) and suppresses autofill", () => {
    render(<SecretInput data-testid="s" value="" onChange={() => {}} />);
    const input = screen.getByTestId<HTMLInputElement>("s");
    // type="text" -> browsers/password managers don't treat it as a credential.
    expect(input.type).toBe("text");
    expect(input.getAttribute("autocomplete")).toBe("off");
    expect(input.getAttribute("data-1p-ignore")).not.toBeNull();
    expect(input.getAttribute("data-lpignore")).toBe("true");
  });

  it("reveals and re-hides the value via the toggle", () => {
    // The visual mask is -webkit-text-security (not observable in happy-dom);
    // the toggle's accessible label tracks the reveal state, so assert that.
    render(<SecretInput data-testid="s" value="secret" onChange={() => {}} />);
    const toggle = screen.getByTestId("secret-input-toggle");
    expect(toggle.getAttribute("aria-label")).toBe("Anzeigen");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-label")).toBe("Verbergen");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-label")).toBe("Anzeigen");
  });
});
