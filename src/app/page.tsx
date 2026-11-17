"use client";

import { useState } from "react";
import { BalanceTape } from "@/components/BalanceTape";
import { QuestionRunner } from "@/components/QuestionRunner";

export default function PracticePage() {
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <div className="space-y-4">
      <h1 className="sr-only">Practice</h1>
      <BalanceTape currentCategoryId={categoryId} refreshKey={refreshKey} />
      <QuestionRunner
        onAttemptChange={(attempt) => {
          setCategoryId(attempt?.question.categoryId ?? null);
          setRefreshKey((k) => k + 1);
        }}
      />
    </div>
  );
}
