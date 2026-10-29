import { Suspense } from "react";
import { NewDocument } from "./new-document";

export default function NewDocumentPage() {
  return (
    <Suspense>
      <NewDocument />
    </Suspense>
  );
}
