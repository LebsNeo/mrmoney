import { PageHeader } from "@/components/PageHeader";
import { HelpCenter } from "@/components/HelpCenter";
import { HELP_SECTIONS } from "@/lib/help-articles";

interface PageProps {
  searchParams: Promise<{ article?: string; section?: string }>;
}

export default async function HelpPage({ searchParams }: PageProps) {
  const params = await searchParams;
  return (
    <div>
      <PageHeader
        title="Help Center"
        description="Everything you need to get the most out of MrCA"
      />
      <HelpCenter
        sections={HELP_SECTIONS}
        initialArticle={params.article}
        initialSection={params.section}
      />
    </div>
  );
}
