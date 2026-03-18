import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/constants";

export default function JobsPage() {
  redirect(ROUTES.JOBS_LIST);
}
