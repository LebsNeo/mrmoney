"use client";

import { cn } from "@/lib/utils";

interface LoadingButtonProps {
  children: React.ReactNode;
  loading?: boolean;
  loadingText?: string;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  className?: string;
}

export function LoadingButton({
  children,
  loading = false,
  loadingText,
  onClick,
  type = "button",
  disabled = false,
  className,
}: LoadingButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={loading || disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
    >
      {loading && (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {loading ? (loadingText ?? children) : children}
    </button>
  );
}
