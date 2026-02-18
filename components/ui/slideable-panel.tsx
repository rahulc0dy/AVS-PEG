"use client";

import { ReactNode, useCallback, useState } from "react";
import Image from "next/image";

const ChevronUpIcon = () => (
  <Image
    src="/icons/chevron-up.svg"
    alt="Expand"
    width={16}
    height={16}
    className="invert"
  />
);

const ChevronDownIcon = () => (
  <Image
    src="/icons/chevron-down.svg"
    alt="Collapse"
    width={16}
    height={16}
    className="invert"
  />
);

const ChevronLeftIcon = () => (
  <Image
    src="/icons/chevron-left.svg"
    alt="Expand"
    width={16}
    height={16}
    className="invert"
  />
);

const ChevronRightIcon = () => (
  <Image
    src="/icons/chevron-right.svg"
    alt="Collapse"
    width={16}
    height={16}
    className="invert"
  />
);

export type SlideablePanelPosition = "top" | "bottom" | "left" | "right";

interface SlideablePanelProps {
  /** Panel title displayed in the toggle button */
  title: string;
  /** Optional icon to display before the title */
  icon?: ReactNode;
  /** Content to render inside the panel */
  children: ReactNode;
  /** Position of the panel (default: bottom) */
  position?: SlideablePanelPosition;
  /** Expanded size of the panel (default: 256px / 16rem) */
  expandedSize?: string;
  /** Whether the panel is initially expanded */
  defaultExpanded?: boolean;
  /** Custom class for the toggle button */
  toggleClassName?: string;
  /** Custom class for the panel container */
  panelClassName?: string;
  /** Callback when panel state changes */
  onToggle?: (isExpanded: boolean) => void;
}

/**
 * A generic slideable panel component that can slide in from any edge.
 * Commonly used for bottom panels, sidebars, or toolbars.
 */
export const SlideablePanel = ({
  title,
  icon,
  children,
  position = "bottom",
  expandedSize = "16rem",
  defaultExpanded = false,
  toggleClassName = "",
  panelClassName = "",
  onToggle,
}: SlideablePanelProps) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const togglePanel = useCallback(() => {
    setIsExpanded((prev) => {
      const newState = !prev;
      onToggle?.(newState);
      return newState;
    });
  }, [onToggle]);

  // Determine positioning classes based on position prop
  const getContainerClasses = () => {
    switch (position) {
      case "top":
        return "fixed top-0 left-0 right-0 z-20 flex flex-col";
      case "bottom":
        return "fixed bottom-0 left-0 right-0 z-20 flex flex-col";
      case "left":
        return "fixed top-0 bottom-0 left-0 z-20 flex flex-row";
      case "right":
        return "fixed top-0 bottom-0 right-0 z-20 flex flex-row";
      default:
        return "fixed bottom-0 left-0 right-0 z-20 flex flex-col";
    }
  };

  // Get toggle button positioning classes
  const getToggleClasses = () => {
    const baseClasses =
      "cursor-pointer bg-zinc-800 px-4 py-2 text-zinc-50 hover:bg-zinc-700 transition-colors flex items-center gap-2";

    switch (position) {
      case "top":
        return `${baseClasses} rounded-b-lg mx-auto w-fit order-2`;
      case "bottom":
        return `${baseClasses} rounded-t-lg mx-auto w-fit`;
      case "left":
        return `${baseClasses} rounded-r-lg my-auto h-fit flex-col py-4 px-2 order-2`;
      case "right":
        return `${baseClasses} rounded-l-lg my-auto h-fit flex-col py-4 px-2 order-1`;
      default:
        return `${baseClasses} rounded-t-lg mx-auto w-fit`;
    }
  };

  // Get panel transition and size classes
  const getPanelClasses = () => {
    const baseClasses =
      "bg-zinc-900/95 backdrop-blur border-zinc-700 transition-all duration-300 ease-in-out overflow-hidden";

    const borderSide = {
      top: "border-b",
      bottom: "border-t",
      left: "border-r",
      right: "border-l",
    }[position];

    switch (position) {
      case "left":
        return `${baseClasses} ${borderSide} h-full order-1`;
      case "right":
        return `${baseClasses} ${borderSide} h-full order-2`;
      default:
        return `${baseClasses} ${borderSide} w-full`;
    }
  };

  // Get expanded/collapsed size style
  const getPanelStyle = () => {
    const isHorizontal = position === "left" || position === "right";
    const sizeProperty = isHorizontal ? "width" : "height";

    return {
      [sizeProperty]: isExpanded ? expandedSize : "0",
    };
  };

  // Render the appropriate chevron based on position and state
  const renderChevron = () => {
    switch (position) {
      case "left":
        return isExpanded ? <ChevronLeftIcon /> : <ChevronRightIcon />;
      case "right":
        return isExpanded ? <ChevronRightIcon /> : <ChevronLeftIcon />;
      case "top":
        return isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />;
      case "bottom":
      default:
        return isExpanded ? <ChevronDownIcon /> : <ChevronUpIcon />;
    }
  };

  // Check if position is horizontal (left/right)
  const isHorizontalPosition = position === "left" || position === "right";

  return (
    <div className={getContainerClasses()}>
      {/* Toggle Button */}
      <div
        className={`${getToggleClasses()} ${toggleClassName}`}
        onClick={togglePanel}
      >
        {icon && <span className="text-emerald-400">{icon}</span>}
        <span
          className={`text-sm font-medium ${isHorizontalPosition ? "[writing-mode:vertical-lr] rotate-180" : ""}`}
        >
          {title}
        </span>
        {renderChevron()}
      </div>

      {/* Expandable Panel */}
      <div
        className={`${getPanelClasses()} ${panelClassName}`}
        style={getPanelStyle()}
      >
        <div className="h-full w-full p-4">{children}</div>
      </div>
    </div>
  );
};
