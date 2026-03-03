"use client";

import { useState, useMemo } from "react";
import { HelpSection, HelpArticle } from "@/lib/help-articles";

interface Props {
  sections: HelpSection[];
  initialArticle?: string;
  initialSection?: string;
}

export function HelpCenter({ sections, initialArticle, initialSection }: Props) {
  const allArticles = useMemo(() => sections.flatMap((s) => s.articles), [sections]);

  const [activeSection, setActiveSection] = useState<string>(
    initialSection ?? sections[0]?.id ?? ""
  );
  const [activeArticle, setActiveArticle] = useState<HelpArticle | null>(
    initialArticle ? (allArticles.find((a) => a.id === initialArticle) ?? null) : null
  );
  const [search, setSearch] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return allArticles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.content.toLowerCase().includes(q)
    );
  }, [search, allArticles]);

  const currentSection = sections.find((s) => s.id === activeSection);
  const displayArticles = search.trim() ? searchResults : (currentSection?.articles ?? []);

  function openArticle(article: HelpArticle) {
    setActiveArticle(article);
    setActiveSection(article.section);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="flex gap-6 min-h-[70vh]">
      {/* ── Sidebar ── */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 gap-1">
        {/* Search */}
        <div className="relative mb-3">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setActiveArticle(null); }}
            placeholder="Search help articles..."
            className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {sections.map((section) => (
          <div key={section.id} className="mb-1">
            <button
              onClick={() => { setActiveSection(section.id); setActiveArticle(null); setSearch(""); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors text-left ${
                activeSection === section.id && !search
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "text-gray-400 hover:text-white hover:bg-gray-800/50"
              }`}
            >
              <span>{section.icon}</span>
              {section.title}
            </button>

            {/* Articles in section */}
            {activeSection === section.id && !search && (
              <div className="ml-3 mt-0.5 pl-3 border-l border-gray-800 space-y-0.5">
                {section.articles.map((article) => (
                  <button
                    key={article.id}
                    onClick={() => openArticle(article)}
                    className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors ${
                      activeArticle?.id === article.id
                        ? "text-emerald-400 bg-emerald-500/5"
                        : "text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    {article.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 min-w-0">
        {/* Mobile search */}
        <div className="lg:hidden mb-4 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setActiveArticle(null); }}
            placeholder="Search help articles..."
            className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Article view */}
        {activeArticle ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            {/* Article header */}
            <div className="px-8 py-6 border-b border-gray-800 bg-gradient-to-r from-emerald-500/5 to-transparent">
              <button
                onClick={() => setActiveArticle(null)}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors mb-4 flex items-center gap-1"
              >
                ← Back to {sections.find((s) => s.id === activeArticle.section)?.title}
              </button>
              <div className="flex items-start gap-4">
                <span className="text-3xl">{activeArticle.icon}</span>
                <div>
                  <h1 className="text-xl font-bold text-white mb-1">{activeArticle.title}</h1>
                  <p className="text-sm text-gray-400">{activeArticle.description}</p>
                </div>
              </div>
            </div>

            {/* Article body */}
            <div
              className="px-8 py-6 help-content"
              dangerouslySetInnerHTML={{ __html: activeArticle.content }}
            />
          </div>
        ) : (
          <>
            {/* Search results or section articles */}
            {search.trim() ? (
              <div>
                <p className="text-sm text-gray-500 mb-4">
                  {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for &quot;{search}&quot;
                </p>
                {searchResults.length === 0 ? (
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
                    <p className="text-4xl mb-3">🔍</p>
                    <p className="text-white font-medium mb-1">No results found</p>
                    <p className="text-sm text-gray-500">Try different keywords or browse sections on the left</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {searchResults.map((article) => (
                      <ArticleCard key={article.id} article={article} onClick={() => openArticle(article)} />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div>
                {/* Section hero */}
                <div className="bg-gradient-to-r from-gray-900 to-gray-900/50 border border-gray-800 rounded-2xl p-6 mb-4 flex items-center gap-4">
                  <span className="text-4xl">{currentSection?.icon}</span>
                  <div>
                    <h2 className="text-lg font-bold text-white">{currentSection?.title}</h2>
                    <p className="text-sm text-gray-400">
                      {currentSection?.articles.length} article{currentSection?.articles.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                {/* Article cards */}
                <div className="space-y-3">
                  {displayArticles.map((article) => (
                    <ArticleCard key={article.id} article={article} onClick={() => openArticle(article)} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ArticleCard({ article, onClick }: { article: HelpArticle; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-gray-900 border border-gray-800 hover:border-emerald-500/30 rounded-2xl p-5 transition-all group hover:bg-gray-800/50"
    >
      <div className="flex items-start gap-4">
        <span className="text-2xl mt-0.5">{article.icon}</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-sm mb-1 group-hover:text-emerald-400 transition-colors">
            {article.title}
          </h3>
          <p className="text-xs text-gray-500 leading-relaxed">{article.description}</p>
        </div>
        <span className="text-gray-700 group-hover:text-gray-400 transition-colors text-sm mt-0.5">→</span>
      </div>
    </button>
  );
}
