import { getAllLinks } from "@/lib/db";
import LinkArchive from "./LinkArchive";

export default function Home() {
  const links = getAllLinks();
  return <LinkArchive initialLinks={links} />;
}
