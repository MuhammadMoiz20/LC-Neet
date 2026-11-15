"use client";
import dynamic from "next/dynamic";
import { useTheme } from "@/components/theme-provider";

const Monaco = dynamic(() => import("@monaco-editor/react"), { ssr: false });

type Props = {
  value: string;
  onChange: (next: string) => void;
};

export function CodeEditor({ value, onChange }: Props) {
  const { theme } = useTheme();
  return (
    <Monaco
      height="100%"
      defaultLanguage="python"
      value={value}
      onChange={(v) => onChange(v ?? "")}
      theme={theme === "dark" ? "vs-dark" : "light"}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 4,
      }}
    />
  );
}
