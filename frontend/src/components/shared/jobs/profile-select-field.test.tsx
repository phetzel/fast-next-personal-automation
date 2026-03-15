import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileSelectField } from "./profile-select-field";
import { useJobProfiles } from "@/hooks/use-job-profiles";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/hooks/use-job-profiles", () => ({
  useJobProfiles: vi.fn(),
}));

const mockUseJobProfiles = vi.mocked(useJobProfiles);

describe("ProfileSelectField", () => {
  beforeEach(() => {
    mockUseJobProfiles.mockReset();
  });

  it("renders an onboarding state when no profiles exist", () => {
    mockUseJobProfiles.mockReturnValue({
      profiles: [],
      currentProfile: null,
      defaultProfile: null,
      isLoading: false,
      error: null,
      hasProfiles: false,
      hasCompleteProfile: false,
      fetchProfiles: vi.fn(),
      getProfile: vi.fn(),
      getDefaultProfile: vi.fn(),
      createProfile: vi.fn(),
      updateProfile: vi.fn(),
      deleteProfile: vi.fn(),
      setDefault: vi.fn(),
      setCurrentProfile: vi.fn(),
      setError: vi.fn(),
    });

    render(<ProfileSelectField id="profile" value={undefined} onChange={vi.fn()} />);

    expect(screen.getByText("No Job Profiles Found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /create profile/i })).toHaveAttribute(
      "href",
      "/jobs/profiles"
    );
  });

  it("shows selected profile details when a profile is chosen", () => {
    mockUseJobProfiles.mockReturnValue({
      profiles: [
        {
          id: "profile-1",
          name: "Primary Profile",
          is_default: true,
          has_resume: true,
          resume_name: "resume.pdf",
          has_story: false,
          story_name: null,
          project_count: 0,
          target_roles_count: 0,
          min_score_threshold: 50,
        },
      ],
      currentProfile: null,
      defaultProfile: null,
      isLoading: false,
      error: null,
      hasProfiles: true,
      hasCompleteProfile: true,
      fetchProfiles: vi.fn(),
      getProfile: vi.fn(),
      getDefaultProfile: vi.fn(),
      createProfile: vi.fn(),
      updateProfile: vi.fn(),
      deleteProfile: vi.fn(),
      setDefault: vi.fn(),
      setCurrentProfile: vi.fn(),
      setError: vi.fn(),
    });

    render(<ProfileSelectField id="profile" value="profile-1" onChange={vi.fn()} />);

    expect(screen.getByRole("combobox")).toHaveTextContent("Primary Profile");
    expect(screen.getByText(/Resume: resume\.pdf/i)).toBeInTheDocument();
  });
});
