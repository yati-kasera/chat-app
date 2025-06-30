import { Suspense } from "react";
import ChatWithPage from "./ChatWithPage";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ChatWithPage />
    </Suspense>
  );
}
