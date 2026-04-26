"use client";
import dynamic from "next/dynamic";

const Monaco = dynamic(() => import("@monaco-editor/react"), { ssr: false });

type Props = {
  value: string;
  onChange: (next: string) => void;
};

export function CodeEditor({ value, onChange }: Props) {
  return (
    <Monaco
      height="100%"
      defaultLanguage="python"
      value={value}
      onChange={(v) => onChange(v ?? "")}
      theme="vs-dark"
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
