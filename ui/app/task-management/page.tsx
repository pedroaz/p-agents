"use client";

import { Button } from "@/components/ui/pixelact-ui/button";

export default function TaskManagement() {
  return (
    <div className="flex flex-col items-center justify-center p-8">
      <span className="pixel-font text-2xl font-bold mb-4">Task Management</span>
      <p className="pixel-font text-gray-600 mb-4">Manage your tasks here.</p>
      <Button onClick={() => console.log("clicked")}>Add Task</Button>
    </div>
  );
}