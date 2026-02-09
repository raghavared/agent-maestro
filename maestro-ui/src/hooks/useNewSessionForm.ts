import { useState, useRef, useEffect } from "react";

interface UseNewSessionFormProps {
  newOpen: boolean;
  activeProjectBasePath: string | null;
  homeDir: string | null;
}

export function useNewSessionForm({
  newOpen,
  activeProjectBasePath,
  homeDir,
}: UseNewSessionFormProps) {
  const [newName, setNewName] = useState("");
  const [newCommand, setNewCommand] = useState("");
  const [newPersistent, setNewPersistent] = useState(true);
  const [newCwd, setNewCwd] = useState("");
  const newNameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!newOpen) return;
    const base = activeProjectBasePath ?? homeDir ?? "";
    setNewCwd(base);
    setNewPersistent(true);
    window.setTimeout(() => {
      newNameRef.current?.focus();
    }, 0);
  }, [newOpen, activeProjectBasePath]);

  const resetForm = () => {
    setNewName("");
    setNewCommand("");
    setNewPersistent(true);
    setNewCwd("");
  };

  return {
    newName,
    setNewName,
    newCommand,
    setNewCommand,
    newPersistent,
    setNewPersistent,
    newCwd,
    setNewCwd,
    newNameRef,
    resetForm,
  };
}
