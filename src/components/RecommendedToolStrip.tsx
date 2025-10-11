"use client";

import type { ComponentProps } from "react";

import { RecommendedToolkits } from "./RecommendedToolkits";

export type RecommendedToolStripProps = ComponentProps<typeof RecommendedToolkits>;

/**
 * Thin naming adapter that forwards all props to the existing RecommendedToolkits component.
 */
export function RecommendedToolStrip(props: RecommendedToolStripProps) {
  return <RecommendedToolkits {...props} />;
}
