"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { api } from "@/lib/api-client";
import type { Project } from "@/types";

interface CreateProjectDialogProps {
  onCreated: (project: Project) => void;
}

export function CreateProjectDialog({ onCreated }: CreateProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    const result = await api<Project>("/api/projects", {
      method: "POST",
      body: JSON.stringify({ name: name.trim() }),
    });

    if (result.ok) {
      onCreated(result.data);
      setName("");
      setOpen(false);
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5" data-testid="create-project-btn">
          <Plus className="h-4 w-4" />
          새 프로젝트
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>새 프로젝트</DialogTitle>
          <DialogDescription>
            프로젝트 이름을 입력하면 6단계 파이프라인이 자동 생성됩니다.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <Input
            placeholder="프로젝트 이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={!name.trim() || isSubmitting}>
              {isSubmitting ? "생성 중..." : "생성"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
