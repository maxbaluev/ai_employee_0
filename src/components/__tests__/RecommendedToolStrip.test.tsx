import { render } from "@testing-library/react";

const recommendedToolkitsMock = vi.hoisted(() =>
  vi.fn((props: Record<string, unknown>) => {
    if (typeof props.children === "function") {
      return props.children();
    }
    return <div data-testid="recommended-toolkits" />;
  }),
);

vi.mock("@/components/RecommendedToolkits", () => ({
  RecommendedToolkits: recommendedToolkitsMock,
}));

const { RecommendedToolStrip } = await import("@/components/RecommendedToolStrip");

describe("RecommendedToolStrip", () => {
  beforeEach(() => {
    recommendedToolkitsMock.mockClear();
  });

  it("forwards props to RecommendedToolkits", () => {
    const onStageAdvance = vi.fn();
    const onAlert = vi.fn();
    const onSelectionChange = vi.fn();

    render(
      <RecommendedToolStrip
        tenantId="tenant-123"
        missionId="mission-456"
        onAlert={onAlert}
        onStageAdvance={onStageAdvance}
        onSelectionChange={onSelectionChange}
      />,
    );

    expect(recommendedToolkitsMock).toHaveBeenCalledTimes(1);
    const forwardedProps = recommendedToolkitsMock.mock.calls[0]?.[0];
    expect(forwardedProps).toMatchObject({
      tenantId: "tenant-123",
      missionId: "mission-456",
      onAlert,
      onStageAdvance,
      onSelectionChange,
    });

    forwardedProps.onStageAdvance?.();
    forwardedProps.onAlert?.({ tone: "info", message: "test" });
    forwardedProps.onSelectionChange?.(2);

    expect(onStageAdvance).toHaveBeenCalled();
    expect(onAlert).toHaveBeenCalledWith({ tone: "info", message: "test" });
    expect(onSelectionChange).toHaveBeenCalledWith(2);
  });

  it("passes through null mission id without modification", () => {
    render(<RecommendedToolStrip tenantId="tenant-123" missionId={null} />);

    const firstCall = recommendedToolkitsMock.mock.calls[0]?.[0];
    expect(firstCall).toMatchObject({ tenantId: "tenant-123", missionId: null });
  });
});
