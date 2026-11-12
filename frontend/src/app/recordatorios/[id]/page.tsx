import { Suspense } from "react";
import { ToolHero } from "@/components/tool-hero";
import { SavedPlantDetails } from "@/components/reminders/saved-plant-details";

async function SavedPlantDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SavedPlantDetails id={id} />;
}

export default function SavedPlantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <>
      <ToolHero toolId="remind" />
      <Suspense fallback={null}>
        <SavedPlantDetailsPage params={params} />
      </Suspense>
    </>
  );
}