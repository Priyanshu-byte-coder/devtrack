import React from "react";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ProfileCard from "@/components/ProfileCard";

describe("ProfileCard", () => {
  it("renders trimmed bio text when provided", () => {
    render(
      <ProfileCard name="Alice" bio="  Full-stack developer  " />,
    );

    expect(screen.getByText("Full-stack developer")).toBeInTheDocument();
  });

  it("renders nothing for whitespace-only bio", () => {
    const { container } = render(
      <ProfileCard name="Alice" bio="   " />,
    );

    expect(container.querySelector(".profile-card__bio")).toBeNull();
  });

  it("shows add bio hint when bio is empty and showAddBioHint is true", () => {
    render(
      <ProfileCard name="Alice" showAddBioHint />,
    );

    const link = screen.getByRole("link", { name: "Add a bio" });
    expect(link).toHaveAttribute("href", "/dashboard/settings");
    expect(screen.getByText(/in Settings/i)).toBeInTheDocument();
  });

  it("renders nothing in body when bio is empty and hint is disabled", () => {
    const { container } = render(<ProfileCard name="Alice" />);

    expect(container.querySelector(".profile-card__bio")).toBeNull();
  });
});
