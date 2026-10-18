import React from "react";
export function Select({
  children,
  value,
  onValueChange,
  disabled,
}: React.PropsWithChildren<{
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
}>) {
  return (
    <select value={value} disabled={disabled} onChange={(e) => onValueChange?.(e.target.value)}>
      <option value="">Selecione</option>
      {children}
    </select>
  );
}
export function SelectContent({ children }: React.PropsWithChildren) {
  return <>{children}</>;
}
export function SelectItem({
  children,
  value,
  disabled,
}: React.PropsWithChildren<{ value: string; disabled?: boolean }>) {
  return (
    <option value={value} disabled={disabled}>
      {children}
    </option>
  );
}
export const SelectTrigger = () => null;
export const SelectValue = () => null;
export const SelectGroup = SelectContent;
export const SelectLabel = () => null;
export const SelectSeparator = () => null;
