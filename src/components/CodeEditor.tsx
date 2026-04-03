
import React, { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { socket } from '@/lib/socket';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { Play, Download, Copy } from 'lucide-react';
import { LanguageBadge } from './LanguageBadge';
import { toast } from 'sonner';

const LANGUAGES = [
  { id: 'javascript', name: 'JavaScript', extension: 'js' },
  { id: 'typescript', name: 'TypeScript', extension: 'ts' },
  { id: 'python', name: 'Python', extension: 'py' },
  { id: 'java', name: 'Java', extension: 'java' },
  { id: 'cpp', name: 'C++', extension: 'cpp' },
  { id: 'csharp', name: 'C#', extension: 'cs' },
  { id: 'go', name: 'Go', extension: 'go' },
  { id: 'rust', name: 'Rust', extension: 'rs' },
];

const BOILERPLATE: Record<string, string> = {
  javascript: `console.log("Hello, World!");`,
  typescript: `function greet(name: string) { return \`Hello, \${name}!\`; }\nconsole.log(greet("World"));`,
  python: `def greet(name):\n    return f"Hello, {name}!"\n\nprint(greet("World"))`,
  java: `public class Main { public static void main(String[] args) { System.out.println("Hello, World!"); } }`,
  cpp: `#include <iostream>\nusing namespace std;\nint main() { cout << "Hello, World!" << endl; return 0; }`,
  csharp: `using System;\nclass Program { static void Main() { Console.WriteLine("Hello, World!"); } }`,
  go: `package main\nimport "fmt"\nfunc main() { fmt.Println("Hello, World!") }`,
  rust: `fn main() { println!("Hello, World!"); }`,
};

const CodeEditor = ({ roomId }: { roomId: string }) => {
  const [language, setLanguage] = useState('javascript');
  const [code, setCode] = useState(BOILERPLATE.javascript);
  const [output, setOutput] = useState('');

  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang);
    if (!code || code === BOILERPLATE[language]) setCode(BOILERPLATE[newLang]);
    socket.emit('language-change', { roomId, language: newLang });
  };

  const handleEditorChange = (value: string | undefined) => {
    const updated = value || '';
    setCode(updated);
    socket.emit('code-change', { roomId, code: updated });
  };

  const runCode = () => {
    if (!code.trim()) {
      toast.error("Cannot run empty code");
      return;
    }
    setOutput(`Running ${language.toUpperCase()} code...\n`);
    socket.emit('run-code', { roomId, code, language });
  };

  useEffect(() => {
    socket.connect();
    socket.emit('join-room', roomId);

    socket.on('code-update', setCode);
    socket.on('language-update', setLanguage);
    socket.on('code-output', setOutput);

    return () => {
      socket.off('code-update');
      socket.off('language-update');
      socket.off('code-output');
      socket.disconnect();
    };
  }, [roomId]);

  const downloadCode = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code.${language}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('File downloaded');
  };

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    toast('Code copied to clipboard');
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      <div className="border-b p-2 bg-card flex justify-between items-center gap-2">
        <Select value={language} onValueChange={handleLanguageChange}>
          <SelectTrigger className="w-[140px] h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((lang) => (
              <SelectItem key={lang.id} value={lang.id}>
                <div className="flex items-center gap-2">
                  <LanguageBadge language={lang.id as any} />
                  <span>{lang.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={copyCode}><Copy size={16} /></Button>
          <Button variant="ghost" size="icon" onClick={downloadCode}><Download size={16} /></Button>
          <Button variant="default" size="sm" onClick={runCode} className="gap-1"><Play size={14} /><span>Run</span></Button>
        </div>
      </div>

      <ResizablePanelGroup direction="vertical" className="flex-grow">
        <ResizablePanel defaultSize={70} minSize={30}>
          <Editor
            height="100%"
            language={language}
            value={code}
            onChange={handleEditorChange}
            options={{ fontSize: 14, lineNumbers: 'on', wordWrap: 'on', automaticLayout: true }}
            theme="vs-dark"
          />
        </ResizablePanel>
        <ResizablePanel defaultSize={30} minSize={15}>
          <div className="h-full p-2 bg-black/70 font-mono text-sm overflow-auto">
            <pre className="whitespace-pre-wrap text-gray-300">{output || '// Output will appear here'}</pre>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default CodeEditor;
