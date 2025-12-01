import React, { forwardRef } from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  color?:
    | "blue"
    | "red"
    | "green"
    | "gray"
    | "teal"
    | "yellow"
    | "rose"
    | "indigo"
    | "purple"
    | "pink"
    | "orange"
    | "cyan"
    | "white";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "primary", color = "blue", className = "", children, ...props },
    ref
  ) => {
    const baseStyles =
      "px-4 py-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:focus:ring-offset-gray-900 cursor-pointer text-sm";

    const variants = {
      primary: {
        blue: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600",
        red: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 dark:bg-red-500 dark:hover:bg-red-600",
        green:
          "bg-green-600 text-white hover:bg-green-700 focus:ring-green-500 dark:bg-green-500 dark:hover:bg-green-600",
        gray: "bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500 dark:bg-gray-500 dark:hover:bg-gray-600",
        teal: "bg-teal-600 text-white hover:bg-teal-700 focus:ring-teal-500 dark:bg-teal-500 dark:hover:bg-teal-600",
        yellow:
          "bg-yellow-600 text-white hover:bg-yellow-700 focus:ring-yellow-500 dark:bg-yellow-500 dark:hover:bg-yellow-600",
        rose: "bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-500 dark:bg-rose-500 dark:hover:bg-rose-600",
        indigo:
          "bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-600",
        purple:
          "bg-purple-600 text-white hover:bg-purple-700 focus:ring-purple-500 dark:bg-purple-500 dark:hover:bg-purple-600",
        pink: "bg-pink-600 text-white hover:bg-pink-700 focus:ring-pink-500 dark:bg-pink-500 dark:hover:bg-pink-600",
        orange:
          "bg-orange-600 text-white hover:bg-orange-700 focus:ring-orange-500 dark:bg-orange-500 dark:hover:bg-orange-600",
        cyan: "bg-cyan-600 text-white hover:bg-cyan-700 focus:ring-cyan-500 dark:bg-cyan-500 dark:hover:bg-cyan-600",
        white:
          "bg-white text-gray-900 hover:bg-gray-100 focus:ring-gray-200 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white",
      },
      secondary: {
        blue: "bg-blue-100 text-blue-900 hover:bg-blue-200 focus:ring-blue-500 dark:bg-blue-900/50 dark:text-blue-100 dark:hover:bg-blue-900/70",
        red: "bg-red-100 text-red-900 hover:bg-red-200 focus:ring-red-500 dark:bg-red-900/50 dark:text-red-100 dark:hover:bg-red-900/70",
        green:
          "bg-green-100 text-green-900 hover:bg-green-200 focus:ring-green-500 dark:bg-green-900/50 dark:text-green-100 dark:hover:bg-green-900/70",
        gray: "bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700",
        teal: "bg-teal-100 text-teal-900 hover:bg-teal-200 focus:ring-teal-500 dark:bg-teal-900/50 dark:text-teal-100 dark:hover:bg-teal-900/70",
        yellow:
          "bg-yellow-100 text-yellow-900 hover:bg-yellow-200 focus:ring-yellow-500 dark:bg-yellow-900/50 dark:text-yellow-100 dark:hover:bg-yellow-900/70",
        rose: "bg-rose-100 text-rose-900 hover:bg-rose-200 focus:ring-rose-500 dark:bg-rose-900/50 dark:text-rose-100 dark:hover:bg-rose-900/70",
        indigo:
          "bg-indigo-100 text-indigo-900 hover:bg-indigo-200 focus:ring-indigo-500 dark:bg-indigo-900/50 dark:text-indigo-100 dark:hover:bg-indigo-900/70",
        purple:
          "bg-purple-100 text-purple-900 hover:bg-purple-200 focus:ring-purple-500 dark:bg-purple-900/50 dark:text-purple-100 dark:hover:bg-purple-900/70",
        pink: "bg-pink-100 text-pink-900 hover:bg-pink-200 focus:ring-pink-500 dark:bg-pink-900/50 dark:text-pink-100 dark:hover:bg-pink-900/70",
        orange:
          "bg-orange-100 text-orange-900 hover:bg-orange-200 focus:ring-orange-500 dark:bg-orange-900/50 dark:text-orange-100 dark:hover:bg-orange-900/70",
        cyan: "bg-cyan-100 text-cyan-900 hover:bg-cyan-200 focus:ring-cyan-500 dark:bg-cyan-900/50 dark:text-cyan-100 dark:hover:bg-cyan-900/70",
        white:
          "bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-300 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700",
      },
      outline: {
        blue: "border border-blue-600 text-blue-600 hover:bg-blue-50 focus:ring-blue-500 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-950",
        red: "border border-red-600 text-red-600 hover:bg-red-50 focus:ring-red-500 dark:border-red-400 dark:text-red-400 dark:hover:bg-red-950",
        green:
          "border border-green-600 text-green-600 hover:bg-green-50 focus:ring-green-500 dark:border-green-400 dark:text-green-400 dark:hover:bg-green-950",
        gray: "border border-gray-600 text-gray-600 hover:bg-gray-50 focus:ring-gray-500 dark:border-gray-400 dark:text-gray-300 dark:hover:bg-gray-800",
        teal: "border border-teal-600 text-teal-600 hover:bg-teal-50 focus:ring-teal-500 dark:border-teal-400 dark:text-teal-400 dark:hover:bg-teal-950",
        yellow:
          "border border-yellow-600 text-yellow-600 hover:bg-yellow-50 focus:ring-yellow-500 dark:border-yellow-400 dark:text-yellow-400 dark:hover:bg-yellow-950",
        rose: "border border-rose-600 text-rose-600 hover:bg-rose-50 focus:ring-rose-500 dark:border-rose-400 dark:text-rose-400 dark:hover:bg-rose-950",
        indigo:
          "border border-indigo-600 text-indigo-600 hover:bg-indigo-50 focus:ring-indigo-500 dark:border-indigo-400 dark:text-indigo-400 dark:hover:bg-indigo-950",
        purple:
          "border border-purple-600 text-purple-600 hover:bg-purple-50 focus:ring-purple-500 dark:border-purple-400 dark:text-purple-400 dark:hover:bg-purple-950",
        pink: "border border-pink-600 text-pink-600 hover:bg-pink-50 focus:ring-pink-500 dark:border-pink-400 dark:text-pink-400 dark:hover:bg-pink-950",
        orange:
          "border border-orange-600 text-orange-600 hover:bg-orange-50 focus:ring-orange-500 dark:border-orange-400 dark:text-orange-400 dark:hover:bg-orange-950",
        cyan: "border border-cyan-600 text-cyan-600 hover:bg-cyan-50 focus:ring-cyan-500 dark:border-cyan-400 dark:text-cyan-400 dark:hover:bg-cyan-950",
        white:
          "border border-white text-white hover:bg-white/10 focus:ring-white dark:border-white dark:text-white dark:hover:bg-white/10",
      },
      ghost: {
        blue: "text-blue-600 hover:bg-blue-50 focus:ring-blue-500 dark:text-blue-400 dark:hover:bg-blue-950",
        red: "text-red-600 hover:bg-red-50 focus:ring-red-500 dark:text-red-400 dark:hover:bg-red-950",
        green:
          "text-green-600 hover:bg-green-50 focus:ring-green-500 dark:text-green-400 dark:hover:bg-green-950",
        gray: "text-gray-600 hover:bg-gray-50 focus:ring-gray-500 dark:text-gray-300 dark:hover:bg-gray-800",
        teal: "text-teal-600 hover:bg-teal-50 focus:ring-teal-500 dark:text-teal-400 dark:hover:bg-teal-950",
        yellow:
          "text-yellow-600 hover:bg-yellow-50 focus:ring-yellow-500 dark:text-yellow-400 dark:hover:bg-yellow-950",
        rose: "text-rose-600 hover:bg-rose-50 focus:ring-rose-500 dark:text-rose-400 dark:hover:bg-rose-950",
        indigo:
          "text-indigo-600 hover:bg-indigo-50 focus:ring-indigo-500 dark:text-indigo-400 dark:hover:bg-indigo-950",
        purple:
          "text-purple-600 hover:bg-purple-50 focus:ring-purple-500 dark:text-purple-400 dark:hover:bg-purple-950",
        pink: "text-pink-600 hover:bg-pink-50 focus:ring-pink-500 dark:text-pink-400 dark:hover:bg-pink-950",
        orange:
          "text-orange-600 hover:bg-orange-50 focus:ring-orange-500 dark:text-orange-400 dark:hover:bg-orange-950",
        cyan: "text-cyan-600 hover:bg-cyan-50 focus:ring-cyan-500 dark:text-cyan-400 dark:hover:bg-cyan-950",
        white:
          "text-white hover:bg-white/10 focus:ring-white dark:text-white dark:hover:bg-white/10",
      },
    };

    const variantStyles = variants[variant][color];

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variantStyles} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
