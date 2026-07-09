"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { useRouter } from "next/navigation";
import { preprocessWikilinks, remarkCallouts, wikilinkStem } from "@/lib/markdown";

export function Markdown({
  content,
  resolve,
}: {
  content: string;
  resolve?: (stem: string) => string | undefined;
}) {
  const router = useRouter();
  const md = preprocessWikilinks(content);

  return (
    <div className="prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkCallouts]}
        rehypePlugins={[rehypeRaw]}
        components={{
          a({ href, children, ...props }) {
            if (href?.startsWith("wikilink:")) {
              const target = wikilinkStem(decodeURIComponent(href.slice("wikilink:".length)));
              const path = resolve?.(target);
              if (path) {
                return (
                  <a
                    className="wikilink"
                    href={`/n/${path}`}
                    onClick={(e) => {
                      e.preventDefault();
                      router.push(`/n/${path}`);
                    }}
                  >
                    {children}
                  </a>
                );
              }
              return <span className="wikilink wikilink-unresolved">{children}</span>;
            }
            const external = href?.startsWith("http");
            return (
              <a href={href} {...(external ? { target: "_blank", rel: "noreferrer" } : {})} {...props}>
                {children}
              </a>
            );
          },
        }}
      >
        {md}
      </ReactMarkdown>
    </div>
  );
}
